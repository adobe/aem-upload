/*
Copyright 2019 Adobe. All rights reserved.
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
const MockRequest = require('./mock-request');

const { timedRequest } = importFile('http-utils');

describe('HttpUtilsTest', () => {
    beforeEach(() => {
        MockRequest.reset();
    });

    describe('timedRequest', () => {
        it('smoke test', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            const {
                status,
                elapsedTime,
            } = await timedRequest({
                url: 'http://timedrequestunittest',
            }, {});

            should(status).be.exactly(200);
            should(elapsedTime >= 100).be.ok();
        });
    });
});
