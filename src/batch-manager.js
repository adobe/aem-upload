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

import uuid from 'uuid';

import { getLock } from './utils';

/**
 * Helper for working with batches, which consist of a number of items that can
 * be processed. The manager provides a way of specifying how many items are in the
 * batch, along with a notification mechanism that indicates when all items in the
 * batch are finished.
 */
export default class BatchManager {

    /**
     * Initializes a new instance of the manager.
     */
    constructor() {
        this.batchCounts = {};
    }

    /**
     * Creates a new batch that will consist of a given number of items.
     * @param {number} totalCount Number of items in the batch.
     * @param {function} callback Invoked when all items in the batch have
     *  been processed.
     * @returns {string} A unique identifier for the new batch.
     */
    createBatch(totalCount, callback) {
        const batchId = uuid();
        this.batchCounts[batchId] = {
            totalCount,
            totalProcessed: 0,
            callback,
        };
        return batchId;
    }

    /**
     * Increments the number of items in a given batch that have been processed.
     * If all items have been processed, the method will also invoke the callback
     * indicating the batch is complete.
     *
     * The method is "thread safe", meaning calling the method concurrently will
     * ensure that the final callback is only called once.
     * @param {string} batchId Unique identifier for the batch to update.
     * @returns {Promise} Will resolve when the batch has been safely updated.
     */
    async updateBatch(batchId) {
        let batchEnded = false;
        // since we're dealing with concurrency, be safe and lock the batch
        // when incrementing to ensure we avoid concurrency issues.
        await getLock(batchId, () => {
            this.batchCounts[batchId].totalProcessed += 1;
            const {
                totalCount,
                totalProcessed,
            } = this.batchCounts[batchId];
            batchEnded = (totalCount === totalProcessed);
        });

        // this may same weird, but doing it this way to ensure that
        // "callback()" is not invoked inside the lock.
        if (batchEnded) {
            const {
                callback,
            } = this.batchCounts[batchId];
            callback();
        }
    }
}
