/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import Async from 'async';

import UploadOptionsBase from './upload-options-base';
import BatchManager from './batch-manager';

/**
 * A queue that will ensure that a maximum number of items within it will
 * be processed concurrently. If at the max, additional items added to the
 * queue will be "blocked" until it's their turn for processing.
 *
 * The queue will automatically begin processing when an item is added, and
 * will restart if previously added items have all finished processing by the
 * time a new item is added.
 *
 * The queue provides the following events:
 * * error: sent if there is an error while processing one of the items in the
 *   queue. Event data will include an "item" property containing the item that
 *   failed (as it was provided when added to the queue), and an "error" property
 *   containing details of the error.
 * * emptied: sent when all the items in the queue have been processed. Could
 *   potentially be called multiple times, depending on the state of the queue
 *   when additional items are added.
 */
export default class ConcurrentQueue extends UploadOptionsBase {

    /**
     * Constructs a new instance of the queue.
     * @param {object} options Used by the super class.
     * @param {DirectBinaryUploadOptions} uploadOptions Used to determine
     *  the maximum number of items to process concurrently. Retrieved using
     *  the options' getMaxConcurrent() method.
     */
    constructor(options, uploadOptions) {
        super(options, uploadOptions);
        this.queue = Async.queue(async (task, callback) => {
            const {
                data,
                worker,
                batch,
            } = task;

            let err;
            try {
                await worker(data);
            } catch (e) {
                err = e;
            }

            await this.batches.updateBatch(batch);

            callback(err);
        }, uploadOptions.getMaxConcurrent());

        // send 'error' event if encountering an error while
        // processing an item.
        this.queue.error((error, task) => {
            const { data = {} } = task;
            this.emit('error', {
                item: data,
                error,
            });
        });

        // will be sent whenever all items added to the queue
        // have processed. may be sent multiple times throughout
        // the life of the queue.
        this.queue.drain(() => {
            this.emit('emptied', true);
        });

        this.batches = new BatchManager();
    }

    /**
     * Adds a new item to the queue for processing.
     * @param {*} item The item to process.
     * @param {function} callback Will be invoked when the item is ready to
     *  be processed. The "callback" function is expected to return a promise. It will be
     *  invoked with a single argument: the item parameter provided in this method.
     * @returns {Promise} Will be resolved when the item has been processed.
     */
    push(item, callback) {
        return new Promise((res) => {
            this.queue.push({
                data: item,
                batch: this.batches.createBatch(1, res),
                worker: callback,
            });
        });
    }

    /**
     * Adds an array of items to the queue for processing. Each item will be
     * passed to the same processing callback.
     * @param {Array} items Array of items to process.
     * @param {function} callback Will be invoked each time an item is ready to
     *  be processed (so it will be multiple times). The function is expected to
     *  return a promise. It will be invoked with a single argument: the item to
     *  be processed.
     * @returns {Promise} Will be resolved when all provided items have been processed.
     */
    pushAll(items, callback) {
        return new Promise((res) => {
            const batch = this.batches.createBatch(items.length, res);
            items.forEach((item) => {
                this.queue.push({
                    data: item,
                    batch,
                    worker: callback,
                });
            });
        });
    }

    /**
     * Retrieves a value indicating whether there is currently anything in the
     * queue.
     * @returns {boolean} True if there are no items in the queue, false otherwise.
     */
    isEmpty() {
        return this.queue.idle();
    }

}
