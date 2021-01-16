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

const { importFile } = require('./testutils');

const UploadResult = importFile('upload-result');
const { setTimeoutPromise } = importFile('utils');

describe('UploadResult Tests', function() {
    it('test timer', async function() {
        const uploadResult = new UploadResult();
        uploadResult.startTimer();
        await setTimeoutPromise(20);
        uploadResult.stopTimer();
        should(uploadResult.getElapsedTime() >= 20).be.ok();
        uploadResult.startTimer();
        await setTimeoutPromise(20);
        uploadResult.stopTimer();
        should(uploadResult.getElapsedTime() >= 40).be.ok();

        uploadResult.addInitTime(20);
        should(uploadResult.getInitTime()).be.exactly(20);
        uploadResult.addInitTime(20);
        should(uploadResult.getInitTime()).be.exactly(40);
    });
});
