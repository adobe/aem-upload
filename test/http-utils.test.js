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
const cookie = require('cookie');

const { importFile } = require('./testutils');
const MockRequest = require('./mock-request');
const { default: HttpResponse } = require('../src/http/http-response');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');

const { timedRequest, updateOptionsWithResponse, isRetryableError } = importFile('http-utils');

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

    function createResponse(headers = {}) {
        return new HttpResponse({}, { headers });
    }

    it('test update options', () => {
        const options = new DirectBinaryUploadOptions();
        updateOptionsWithResponse(options, createResponse());
        should(options.getHeaders().Cookie).not.be.ok();
        updateOptionsWithResponse(options, createResponse({ 'set-cookie': [] }));
        should(options.getHeaders().Cookie).not.be.ok();
        updateOptionsWithResponse(options, createResponse({ 'set-cookie': [cookie.serialize('cookie', 'value')]}));
        should(options.getHeaders().Cookie).be.ok();
        should(cookie.parse(options.getHeaders().Cookie).cookie).be.exactly('value');
    });

    it('test is retryable error', () => {
        should(isRetryableError(false)).be.ok();
        should(isRetryableError(true)).be.ok();
        should(isRetryableError({ isAxiosError: true })).be.ok();
        should(isRetryableError({
            isAxiosError: true,
            response: {
                status: 404
            }
        })).not.be.ok();
        should(isRetryableError({
            isAxiosError: true,
            response: {
            }
        })).be.ok();
        should(isRetryableError({
            isAxiosError: true,
            response: {
                status: 500
            }
        })).be.ok();
    });
});
