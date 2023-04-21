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

const { getTestOptions } = require('./testutils');

const DirectBinaryUploadOptions = require('../src/direct-binary-upload-options');

const {
  getHttpTransferOptions,
} = require('../src/http-utils');

describe('HttpUtilsTest', () => {
  it('test get http transfer options', () => {
    const uploadOptions = new DirectBinaryUploadOptions()
      .withUrl('http://localhost/content/dam');
    let httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
    should(httpTransfer).deepEqual({
      requestOptions: {},
      concurrent: true,
      maxConcurrent: 5,
      uploadFiles: [],
      headers: {},
    });

    uploadOptions.withConcurrent(false)
      .withHttpOptions({
        headers: {
          hello: 'world!',
        },
        method: 'DELETE',
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
      }]);

    // test proxying to http endpoint - requests made with node-httptransfer
    httpTransfer = getHttpTransferOptions(getTestOptions(), uploadOptions);
    should(httpTransfer).deepEqual({
      headers: {
        hello: 'world!',
      },
      requestOptions: {
        method: 'DELETE',
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
  });
});
