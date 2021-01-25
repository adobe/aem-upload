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

const should = require('should');

const { importFile, getTestOptions } = require('./testutils');
const ConcurrentQueue = importFile('concurrent-queue');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const { setTimeoutPromise } = importFile('utils');

describe('concurrent queue tests', function() {
    let queue;
    let uploadOptions;
    let errors;

    beforeEach(function() {
        errors = [];
        uploadOptions = new DirectBinaryUploadOptions();
        queue = new ConcurrentQueue(getTestOptions(), uploadOptions);
        queue.on('error', (data) => {
            errors.push(data);
        });
    });

    it('test push', function(done) {
        let processed = 0;
        let concurrent = 0;
        const totalIterations = 20;
        const processedIndexes = {};
        for (let i = 0; i < totalIterations; i++) {
            queue.push({ hello: `world`, index: i }, async (data) => {
                const {  hello, index } = data;
                should(hello).be.exactly('world');
                should(processedIndexes[index]).not.be.ok();
                processedIndexes[index] = true;
                concurrent += 1;
                should(concurrent).be.lessThanOrEqual(uploadOptions.getMaxConcurrent());
                await setTimeoutPromise(10);
                concurrent -= 1;
                processed += 1;
                should(concurrent).be.lessThanOrEqual(totalIterations);
            });
        }

        // verify case where the queue has been emptied, but more items are
        // added
        let emptied = 0;
        queue.on('emptied', async () => {
            emptied += 1;
            if (emptied === 1) {
                // after the first emptied, add another item to the idle
                // queue
                should(processed).be.exactly(totalIterations);
                should(queue.isEmpty()).be.ok();
                await queue.push({ goodbye: 'world' }, async (data) => {
                    const { goodbye } = data;
                    should(goodbye).be.exactly('world');
                    should(errors.length).be.exactly(0);
                });
            } else {
                // second empty indicates that we're complete
                should(emptied).be.exactly(2);
                done();
            }
        });
    });

    it('test multiple push', async function() {
        let numProcessed = 0;
        await queue.pushAll([1, 2, 3, 4, 5], async () => {
            await setTimeoutPromise(10);
            numProcessed += 1;
        });
        should(numProcessed).be.exactly(5);
    });

    it('test errors', function(done) {
        queue.push({ error: 'error!' }, async () => {
            throw new Error('Unit test!');
        });

        queue.on('emptied', () => {
            should(errors.length).be.exactly(1);
            const { item = {} } = errors[0];
            const { error } = item;
            should(error).be.exactly('error!');
            done();
        });
    });
});
