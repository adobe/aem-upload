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

const { importFile, getTestOptions, getTestUploadOptions } = require('./testutils');
const MockRequest = require('./mock-request');
const { default: HttpResponse } = require('../src/http/http-response');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');

const {
    timedRequest,
    updateOptionsWithResponse,
    isRetryableError,
    getProxyAgentOptions,
    getHttpTransferOptions,
} = importFile('http-utils');
const HttpProxy = importFile('http-proxy');

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

        it('no agent if no proxy and no strictSSL', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).not.be.ok();
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
            }, {});
        });

        it('proxy to http endpoint', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpsAgent).not.be.ok();
                should(requestOptions.httpAgent).be.ok();
                should(requestOptions.httpAgent.proxy).be.ok();
                should(requestOptions.httpAgent.constructor.name).equal('HttpProxyAgent');
                should(requestOptions.httpAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpAgent.proxy.port).equal('8080');
                should(requestOptions.httpAgent.proxy.protocol).equal('http:');
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'http://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                }
            }, {});
        });

        it('proxy to http endpoint with strictSSL=false', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpsAgent).not.be.ok();
                should(requestOptions.httpAgent).be.ok();
                should(requestOptions.httpAgent.proxy).be.ok();
                should(requestOptions.httpAgent.constructor.name).equal('HttpProxyAgent');
                should(requestOptions.httpAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpAgent.proxy.port).equal('8080');
                should(requestOptions.httpAgent.proxy.protocol).equal('http:');
                should(requestOptions.httpAgent.options.rejectUnauthorized).equal(false);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'http://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                },
                strictSSL: false,
            }, {});
        });

        it('proxy to http endpoint with strictSSL=true', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpsAgent).not.be.ok();
                should(requestOptions.httpAgent).be.ok();
                should(requestOptions.httpAgent.proxy).be.ok();
                should(requestOptions.httpAgent.constructor.name).equal('HttpProxyAgent');
                should(requestOptions.httpAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpAgent.proxy.port).equal('8080');
                should(requestOptions.httpAgent.proxy.protocol).equal('http:');
                should(requestOptions.httpAgent.options.rejectUnauthorized).equal(true);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'http://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                },
                strictSSL: true,
            }, {});
        });

        it('proxy to https endpoint', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.proxy).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('HttpsProxyAgent');
                should(requestOptions.httpsAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpsAgent.proxy.port).equal('8080');
                should(requestOptions.httpsAgent.proxy.protocol).equal('http:');
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                }
            }, {});
        });

        it('proxy to https endpoint with strictSSL=false', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.proxy).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('HttpsProxyAgent');
                should(requestOptions.httpsAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpsAgent.proxy.port).equal('8080');
                should(requestOptions.httpsAgent.proxy.protocol).equal('http:');
                should(requestOptions.httpsAgent.options.rejectUnauthorized).equal(false);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                },
                strictSSL: false,
            }, {});
        });

        it('proxy to https endpoint with strictSSL=true', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.proxy).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('HttpsProxyAgent');
                should(requestOptions.httpsAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpsAgent.proxy.port).equal('8080');
                should(requestOptions.httpsAgent.proxy.protocol).equal('http:');
                should(requestOptions.httpsAgent.options.rejectUnauthorized).equal(true);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                },
                strictSSL: true,
            }, {});
        });

        it('proxy to https endpoint with strictSSL unset', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('HttpsProxyAgent');
                should(requestOptions.httpsAgent.proxy).be.ok();
                should(requestOptions.httpsAgent.proxy.hostname).equal('myproxy');
                should(requestOptions.httpsAgent.proxy.port).equal('8080');
                should(requestOptions.httpsAgent.proxy.protocol).equal('http:');
                should(requestOptions.httpsAgent.options.rejectUnauthorized).not.be.ok();
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                proxy: {
                    protocol: 'http',
                    host: 'myproxy',
                    port: '8080'
                },
            }, {});
        });

        it('node agent if no proxy and strictSSL=false to https endpoint', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('Agent');
                should(requestOptions.httpsAgent.proxy).not.be.ok();
                should(requestOptions.httpsAgent.options.rejectUnauthorized).equals(false);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                strictSSL: false,
            }, {});
        });

        it('node agent if no proxy and strictSSL=true to https endpoint', async () => {
            MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).be.ok();
                should(requestOptions.httpsAgent.constructor.name).equal('Agent');
                should(requestOptions.httpsAgent.proxy).not.be.ok();
                should(requestOptions.httpsAgent.options.rejectUnauthorized).equals(true);
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'https://timedrequestunittest',
                strictSSL: true,
            }, {});
        });

        it('no agent if no proxy and strictSSL=false to http endpoint', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply((requestOptions) => {
                should(requestOptions.httpAgent).not.be.ok();
                should(requestOptions.httpsAgent).not.be.ok();
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            await timedRequest({
                url: 'http://timedrequestunittest',
                strictSSL: false,
            }, {});
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


    it('test get http transfer options', function() {
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://localhost/content/dam');
        let httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions)
        should(httpTransfer).deepEqual({
            headers: {},
            concurrent: true,
            maxConcurrent: 5,
            uploadFiles: []
        });
    });

    // contains href
    it('test get http transfer options - proxy to http endpoint', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('http://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpProxyAgent');
    });


    it('test get http transfer options - proxy to http endpoint with strictSSL=false', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('htts://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: false }), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpProxyAgent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(false);
    });


    it('test get http transfer options - proxy to http endpoint with strictSSL=true', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('http://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: true }), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpProxyAgent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(true);
    });


    it('test get http transfer options - proxy to https endpoint', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpsProxyAgent');
    });


    it('test get http transfer options - proxy to https endpoint with strictSSL=false', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: false }), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpsProxyAgent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(false);
    });


    it('test get http transfer options - proxy to https endpoint with strictSSL=true', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam')
          .withHttpProxy(new HttpProxy('http://localhost:1234'));

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: true }), uploadOptions);
      should(httpTransfer.requestOptions).be.ok();
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpsProxyAgent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(true);
    });


    it('test get http transfer options - no requestOptions when no proxy or strictSSL', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam');

      const httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
      should(httpTransfer.requestOptions).not.be.ok();
    });


    it('test get http transfer options - node https agent when strictSSL=false and no proxy', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam');

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: false }), uploadOptions);
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('Agent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(false);
    });


    it('test get http transfer options - node https agent when strictSSL=true and no proxy', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('https://localhost/content/dam');

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: true }), uploadOptions);
      should(httpTransfer.requestOptions.agent).be.ok();
      should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('Agent');
      should(httpTransfer.requestOptions.agent.options.rejectUnauthorized).be.exactly(true);
    });

    it('test get http transfer options - no agent when http endpoint with strictSSL=false', function() {
      const uploadOptions = getTestUploadOptions()
          .withUrl('http://localhost/content/dam');

      const httpTransfer = getHttpTransferOptions(getTestOptions({ strictSSL: false }), uploadOptions);
      should(httpTransfer.requestOptions).not.be.ok();
    });


    it('test get proxy agent options', () => {
        const uploadOptions = new DirectBinaryUploadOptions();
        should(getProxyAgentOptions(uploadOptions)).not.be.ok();
        uploadOptions.withHttpProxy(new HttpProxy('http://localhost:1234'));
        let proxyOptions = getProxyAgentOptions(uploadOptions);
        should(proxyOptions.protocol).be.exactly('http:');
        should(proxyOptions.hostname).be.exactly('localhost');
        should(proxyOptions.port).be.exactly('1234');
        should(proxyOptions.auth).not.be.ok();

        uploadOptions.withHttpProxy(
            new HttpProxy('https://127.0.0.1:4321')
                .withBasicAuth('admin', 'pass'));
        proxyOptions = getProxyAgentOptions(uploadOptions);
        should(proxyOptions.protocol).be.exactly('https:');
        should(proxyOptions.hostname).be.exactly('127.0.0.1');
        should(proxyOptions.port).be.exactly('4321');
        should(proxyOptions.auth).be.exactly('admin:pass');
    });
});
