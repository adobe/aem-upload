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
const { EventEmitter } = require('events');
const Sinon = require('sinon');

const { importFile, getTestOptions } = require('../testutils');
const MockRequest = require('../mock-request');

const HttpClient = importFile('http/http-client');
const HttpRequest = importFile('http/http-request');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const HttpResult = importFile('http-result');

const HOST = 'http://adobe-aem-upload-unit-test';

describe('HTTP Client Tests', function() {
    let httpResult;
    let options;
    let uploadOptions;
    let httpClient;

    before(function() {
        this.clock = Sinon.useFakeTimers(10);
    });

    after(function() {
        this.clock.restore();
    });

    beforeEach(function() {
        MockRequest.reset();
        options = getTestOptions();
        uploadOptions = new DirectBinaryUploadOptions()
            .withHttpRetryDelay(10);
        httpClient = new HttpClient(options, uploadOptions);
        httpResult = new HttpResult(options, uploadOptions);
    });

    function createHttpRequest(url) {
        return new HttpRequest(options, url);
    }

    it('http request submit smoke test', async function() {
        MockRequest.onGet(HOST).reply(200, 'hello world!');
        const response = await httpClient.submit(createHttpRequest(HOST));

        should(response).be.ok();
        should(response.getStatusCode()).be.exactly(200);
        should(response.getData()).be.exactly('hello world!');
        should(response.getElapsedTime() !== undefined).be.ok();
    });

    it('http post request submit smoke test', async function() {
        const emitter = new EventEmitter();
        MockRequest.onPost(HOST).reply(() => {
            emitter.emit('data', { length: 100 });
            this.clock.tick(500);
            emitter.emit('data', { length: 200 });
            this.clock.tick(600);
            emitter.emit('data', { length: 300 });
            this.clock.tick(600);
            emitter.emit('data', { length: 400 });
            return [
                201,
                'success',
            ];
        });

        const request = createHttpRequest(HOST)
            .withData(emitter, 10)
            .withMethod(HttpRequest.Method.POST);

        const progressEvents = [];
        request.on('progress', (data) => {
            progressEvents.push(data);
        });

        const response = await httpClient.submit(request);

        should(response).be.ok();
        should(response.getStatusCode()).be.exactly(201);
        should(progressEvents.length).be.exactly(4);
        should(progressEvents[0].transferred).be.exactly(100);
        should(progressEvents[1].transferred).be.exactly(200);
        should(progressEvents[2].transferred).be.exactly(300);
        should(progressEvents[3].transferred).be.exactly(400);
    });

    it('test submit retry', async function() {
        this.clock.restore();

        const url = HOST;
        MockRequest.onGet(url).replyOnce(500);
        MockRequest.onGet(url).reply(200, 'retried!');

        const response = await httpClient.submit(createHttpRequest(url), httpResult);
        should(response).be.ok();

        should(MockRequest.history.get.length).be.exactly(2);
        should(httpResult.getRetryErrors().length).be.exactly(1);
    });

    it('test submit retry network error', async function() {
        this.clock.restore();

        const url = HOST;
        MockRequest.onGet(url).networkErrorOnce();
        MockRequest.onGet(url).reply(200, 'retried!');

        const response = await httpClient.submit(createHttpRequest(url), httpResult);
        should(response).be.ok();

        should(MockRequest.history.get.length).be.exactly(2);
        should(httpResult.getRetryErrors().length).be.exactly(1);
    });

    it('test submit retry all fail', async function() {
        this.clock.restore();

        const url = HOST;
        MockRequest.onGet(url).reply(500);

        let threw = false;
        try {
            await httpClient.submit(createHttpRequest(url));
        } catch (e) {
            threw = true;
        }
        should(MockRequest.history.get.length).be.exactly(3);
        should(threw).be.ok();
    });

    it('test submit retry not retryable error', async function() {
        const url = HOST;

        let threw = false;
        try {
            await httpClient.submit(createHttpRequest(url));
        } catch (e) {
            threw = true;
        }
        should(threw).be.ok();
        should(MockRequest.history.get.length).be.exactly(1);
    });

    async function runCancelTest(options = {}) {
        const {
            cancelId = 'cancelrequest',
            cancelFunction = function() {
                should(httpClient.isCancelled(cancelId)).not.be.ok();
                httpClient.cancel(cancelId);
                should(httpClient.isCancelled(cancelId)).be.ok();
            }
        } = options;
        const url = HOST;

        MockRequest.onGet(url).reply(MockRequest.withDelay(200, [200, 'cancelme']));

        setTimeout(cancelFunction, 100);

        return httpClient.submit(createHttpRequest(url).withCancelId('cancelrequest'));
    }

    it('test cancel', async function() {
        this.clock.restore();

        let code = '';
        try {
            await runCancelTest();
        } catch (e) {
            code = e.code;
        }

        should(code).be.exactly('EUSERCANCELLED');
    });

    it('test cancel no matching id', async function() {
        this.clock.restore();

        return runCancelTest({ cancelId: 'invalid' });
    });

    async function runControllerCancelTest(cancelId = 'cancelrequest') {
        return runCancelTest({
            cancelFunction: () => {
                const controller = uploadOptions.getController();
                controller.cancelFile(cancelId);
            }
        })
    }

    it('test cancel via controller', async function() {
        this.clock.restore();

        let code = '';

        try {
            await runControllerCancelTest();
        } catch (e) {
            code = e.code;
        }

        should(code).be.exactly('EUSERCANCELLED');
    });

    it('test cancel via controller no matching id', async function() {
        this.clock.restore();

        return runControllerCancelTest('invalid');
    });

    it('test cancel all', async function() {
        this.clock.restore();

        let code = '';

        try {
            await runCancelTest({
                cancelFunction: () => {
                    httpClient.cancelAll()
                }
            });
        } catch (e) {
            code = e.code;
        }

        should(code).be.exactly('EUSERCANCELLED');
    });

    it('test cancel all via controller', async function() {
        this.clock.restore();

        let code = '';
        try {
            await runCancelTest({
                cancelFunction: () => {
                    const controller = uploadOptions.getController();
                    controller.cancel();
                }
            });
        } catch(e) {
            code = e.code;
        }

        should(code).be.exactly('EUSERCANCELLED');
    });

    it('test cancel multiple requests', async function() {
        this.clock.restore();
        const url = HOST;
        const url2 = `${HOST}1`;
        MockRequest.onGet(url).reply(MockRequest.withDelay(150, [200, 'cancelme']));
        MockRequest.onGet(url2).reply(MockRequest.withDelay(200, [200, 'cancelme']));
        let cancelCount = 0;
        setTimeout(async () => {
            try {
                await httpClient.submit(createHttpRequest(url).withCancelId('multiple'));
            } catch (e) {
                should(e.code).be.exactly('EUSERCANCELLED');
                cancelCount++;
            }
        }, 1);

        setTimeout(function() {
            httpClient.cancel('multiple');
        }, 100);

        try {
            await httpClient.submit(createHttpRequest(url2).withCancelId('multiple'));
        } catch (e) {
            should(e.code).be.exactly('EUSERCANCELLED');
            cancelCount++;
        }

        should(cancelCount).be.exactly(2);
    });
});
