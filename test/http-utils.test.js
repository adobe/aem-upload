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

/* eslint-env mocha */

const should = require('should');
const cookie = require('cookie');

const { importFile, getTestOptions } = require('./testutils');
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
      MockRequest.onGet('http://timedrequestunittest').reply(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve([200, { success: true }]);
        }, 100);
      }));

      const {
        status,
        elapsedTime,
      } = await timedRequest({
        url: 'http://timedrequestunittest',
      }, {});

      should(status).be.exactly(200);
      should(elapsedTime >= 100).be.ok();
    });

    it('proxy to http endpoint (requests made with axios)', async () => {
      MockRequest.onGet('http://timedrequestunittest').reply((requestOptions) => {
        should(requestOptions.httpsAgent).not.be.ok();
        should(requestOptions.httpAgent).be.ok();
        should(requestOptions.httpAgent.proxy).be.ok();
        should(requestOptions.httpAgent.proxy.host).equal('myproxy');
        should(requestOptions.httpAgent.proxy.port).equal(8080);
        should(requestOptions.httpAgent.proxy.protocol).equal('http');
        return new Promise((resolve) => {
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
          port: '8080',
        },
      }, {});
    });

    it('proxy to https endpoint (requests made with axios)', async () => {
      MockRequest.onGet('https://timedrequestunittest').reply((requestOptions) => {
        should(requestOptions.httpAgent).not.be.ok();
        should(requestOptions.httpsAgent).be.ok();
        should(requestOptions.httpsAgent.proxy).be.ok();
        should(requestOptions.httpsAgent.proxy.host).equal('myproxy');
        should(requestOptions.httpsAgent.proxy.port).equal(8080);
        should(requestOptions.httpsAgent.proxy.protocol).equal('http');
        return new Promise((resolve) => {
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
          port: '8080',
        },
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
    updateOptionsWithResponse(options, createResponse({ 'set-cookie': [cookie.serialize('cookie', 'value')] }));
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
        status: 404,
      },
    })).not.be.ok();
    should(isRetryableError({
      isAxiosError: true,
      response: {
      },
    })).be.ok();
    should(isRetryableError({
      isAxiosError: true,
      response: {
        status: 500,
      },
    })).be.ok();
  });

  it('test get http transfer options', () => {
    const uploadOptions = new DirectBinaryUploadOptions()
      .withUrl('http://localhost/content/dam');
    let httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
    should(httpTransfer).deepEqual({
      headers: {},
      concurrent: true,
      maxConcurrent: 5,
      uploadFiles: [],
    });

    uploadOptions.withConcurrent(false)
      .withHeaders({
        hello: 'world!',
      })
      .withUploadFiles([{
        fileSize: 1024,
        fileName: 'file.jpg',
        filePath: '/my/test/file.jpg',
        createVersion: true,
        versionComment: 'My Comment',
        versionLabel: 'Version Label',
        replace: true,
        partHeaders: {
          part: 'header',
        },
      }, {
        fileSize: 2048,
        fileName: 'blob-file.jpg',
        blob: [1, 2, 3],
      }])
      .withHttpProxy(new HttpProxy('http://localhost:1234'));

    // test proxying to http endpoint - requests made with node-httptransfer
    httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
    should(httpTransfer.requestOptions).be.ok();
    should(httpTransfer.requestOptions.agent).be.ok();
    should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpProxyAgent');
    delete httpTransfer.requestOptions;
    should(httpTransfer).deepEqual({
      headers: {
        hello: 'world!',
      },
      concurrent: false,
      maxConcurrent: 1,
      uploadFiles: [{
        createVersion: true,
        filePath: '/my/test/file.jpg',
        fileSize: 1024,
        fileUrl: 'http://localhost/content/dam/file.jpg',
        multipartHeaders: {
          part: 'header',
        },
        replace: true,
        versionComment: 'My Comment',
        versionLabel: 'Version Label',
      }, {
        blob: [1, 2, 3],
        fileSize: 2048,
        fileUrl: 'http://localhost/content/dam/blob-file.jpg',
      }],
    });

    // test proxying to https endpoint - requests made with node-httptransfer
    uploadOptions.withUrl('https://localhost/content/dam');
    httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
    should(httpTransfer.requestOptions).be.ok();
    should(httpTransfer.requestOptions.agent).be.ok();
    should(httpTransfer.requestOptions.agent.constructor.name).be.exactly('HttpsProxyAgent');
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
        .withBasicAuth('admin', 'pass'),
    );
    proxyOptions = getProxyAgentOptions(uploadOptions);
    should(proxyOptions.protocol).be.exactly('https:');
    should(proxyOptions.hostname).be.exactly('127.0.0.1');
    should(proxyOptions.port).be.exactly('4321');
    should(proxyOptions.auth).be.exactly('admin:pass');
  });
});
