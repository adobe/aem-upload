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

const Async = require('async');
const should = require('should');

const { importFile } = require('./testutils');

const BatchManager = importFile('batch-manager');

describe('batch manager tests', function() {
    let manager;

    beforeEach(function() {
        manager = new BatchManager();
    });

    it('test batch', function(done) {
        const batchCount = 50;
        let doneCount = 0;
        let batchId = manager.createBatch(batchCount, () => {
            doneCount += 1;
            should(doneCount).be.exactly(1);
            done();
        });
        should(batchId).be.ok();
        Async.times(batchCount, async () => {
            return manager.updateBatch(batchId);
        }, () => {});
    });
});
