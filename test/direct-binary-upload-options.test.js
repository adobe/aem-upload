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

const DirectBinaryUploadOptions = require('../src/direct-binary-upload-options');

describe('DirectBinaryUploadOptionsTest', () => {
  it('test url slashes', () => {
    const options = new DirectBinaryUploadOptions()
      .withUrl('/');

    should(options.getUrl()).be.exactly('/');
    options.withUrl('/trailing/');
    should(options.getUrl()).be.exactly('/trailing');
  });

  it('test getTargetFolderPath', () => {
    const options = new DirectBinaryUploadOptions()
      .withUrl('http://somereallyfakeurlhopefully/content/dam/test%20path/asset.jpg');
    should(options.getTargetFolderPath()).be.exactly('/content/dam/test path/asset.jpg');
  });

  it('test with http options', () => {
    const options = new DirectBinaryUploadOptions()
      .withHttpOptions({
        headers: {
          header1: 'test1',
          header2: 'test2',
        },
        method: 'PUT',
        proxy: 'testproxy',
      })
      .withHttpOptions({
        headers: {
          header1: 'test1-1',
          header3: 'value3',
        },
        method: 'POST',
        hello: 'world!',
      });
    should(options.getHttpOptions()).deepEqual({
      headers: {
        header1: 'test1-1',
        header2: 'test2',
        header3: 'value3',
      },
      method: 'POST',
      proxy: 'testproxy',
      hello: 'world!',
    });
  });
});
