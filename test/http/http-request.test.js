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

/* eslint-env mocha */

const should = require('should');
const { EventEmitter } = require('events');
const fs = require('fs');
const MockFs = require('mock-fs');
const Sinon = require('sinon');

const { getTestOptions } = require('../testutils');

const HttpRequest = require('../../src/http/http-request');
const DirectBinaryUploadOptions = require('../../src/direct-binary-upload-options');
const HttpProxy = require('../../src/http-proxy');

const HOST = 'http://adobe-aem-upload-unit-test';

describe('HTTP Request Tests', () => {
  // eslint-disable-next-line func-names
  before(function () {
    this.clock = Sinon.useFakeTimers(10);
  });

  // eslint-disable-next-line func-names
  after(function () {
    this.clock.restore();
  });

  beforeEach(() => {
    MockFs({
      '/testfile.txt': '1234567890',
    });
  });

  afterEach(() => {
    MockFs.restore();
  });

  it('test empty', () => {
    const request = new HttpRequest(getTestOptions(), HOST)
      .withUploadOptions(new DirectBinaryUploadOptions());

    const options = request.toJSON();
    const {
      url,
      method,
      headers,
      timeout,
    } = options;
    should(url).be.exactly(HOST);
    should(method).be.exactly(HttpRequest.Method.GET);
    should(headers).be.ok();
    should(timeout).be.ok();
  });

  it('test accessors', () => {
    const request = new HttpRequest(getTestOptions(), HOST)
      .withUploadOptions(new DirectBinaryUploadOptions()
        .withHeaders({
          uploadHeader: 'upload',
          header1: 'uploadoptions',
        })
        .withHttpProxy(new HttpProxy('http://somereallyfakedomainhost:1234')))
      .withContentType('application/json')
      .withHeaders({
        header1: 'test1',
        header2: 'test',
      })
      .withHeaders({
        header2: 'test2',
        header3: 'test3',
      })
      .withData('hello world!', 10)
      .withResponseType(HttpRequest.ResponseType.TEXT)
      .withCancelId('cancelId');

    let options = request.toJSON();
    const {
      url,
      method,
      headers = {},
      data,
      responseType,
      timeout,
      proxy,
    } = options;

    should(url).be.exactly(HOST);
    should(method).be.exactly(HttpRequest.Method.GET);
    should(data).be.exactly('hello world!');
    should(responseType).be.exactly(HttpRequest.ResponseType.TEXT);
    should(timeout).be.ok();
    should(proxy).deepEqual({
      host: 'somereallyfakedomainhost',
      protocol: 'http',
      port: 1234,
    });

    const {
      header1,
      header2,
      header3,
      uploadHeader,
    } = headers;
    should(header1).be.exactly('test1');
    should(header2).be.exactly('test2');
    should(header3).be.exactly('test3');
    should(uploadHeader).be.exactly('upload');
    should(headers['Content-Type']).be.exactly('application/json');

    should(request.getCancelId()).be.exactly('cancelId');

    request.withMethod(HttpRequest.Method.POST);
    options = request.toJSON();
    should(options.method).be.exactly(HttpRequest.Method.POST);
  });

  it('test content length header', () => {
    const request = new HttpRequest(
      getTestOptions(),
      HOST,
    )
      .withData(fs.createReadStream('/testfile.txt'), 10)
      .withUploadOptions(new DirectBinaryUploadOptions());

    const options = request.toJSON();
    const { headers = {} } = options;
    should(headers['Content-Length']).be.exactly(10);
  });

  it('test progress event', () => {
    const request = new HttpRequest(getTestOptions(), HOST)
      .withData('testing', 10);

    let totalTransferred = 0;
    request.on('progress', (progressData) => {
      totalTransferred += progressData.transferred;
    });

    request.requestOptions.onUploadProgress({ loaded: 100 });
    request.requestOptions.onUploadProgress({ loaded: 200 });
    request.requestOptions.onUploadProgress({ loaded: 300 });
    request.requestOptions.onUploadProgress({ });
    should(totalTransferred).be.exactly(300);
  });

  // eslint-disable-next-line func-names
  it('test progress event stream', function () {
    const emitter = new EventEmitter();
    const request = new HttpRequest(getTestOptions(), HOST)
      .withData(emitter, 10);

    let totalTransferred = 0;
    request.on('progress', (progressData) => {
      totalTransferred += progressData.transferred;
    });

    emitter.emit('data', '12345');
    emitter.emit('data', '6789');
    this.clock.tick(2000);
    emitter.emit('data', '123');

    should(totalTransferred).be.exactly(12);
  });
});
