/*
Copyright 2021 Adobe. All rights reserved.
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

const FileSystemUploadOptions = require('../src/filesystem-upload-options');
const HttpProxy = require('../src/http-proxy');

describe('FileSystemUploadOptions Tests', () => {
  let options;
  beforeEach(() => {
    options = new FileSystemUploadOptions();
  });

  it('test accessors', () => {
    should(options.getUploadFileOptions()).be.ok();
    const newOptions = options.withUploadFileOptions({ hello: 'world!' });
    should(newOptions).be.ok();
    should(options.getUploadFileOptions().hello).be.exactly('world!');
  });

  it('test from options', async () => {
    let fileOptions = new FileSystemUploadOptions()
      .withMaxUploadFiles(20)
      .withDeepUpload(true)
      .withFolderNodeNameProcessor(async (name) => name)
      .withAssetNodeNameProcessor(async (name) => name)
      .withInvalidCharacterReplaceValue('_')
      .withUploadFileOptions({ hello: 'world' });
    let copiedOptions = FileSystemUploadOptions.fromOptions(fileOptions);
    should(copiedOptions).be.ok();
    should(copiedOptions.getInvalidCharacterReplaceValue()).be.exactly('_');
    should(copiedOptions.getMaxUploadFiles()).be.exactly(20);
    should(copiedOptions.getDeepUpload()).be.ok();
    should(copiedOptions.getUploadFileOptions().hello).be.exactly('world');
    should(copiedOptions.getHttpProxy()).not.be.ok();
    should(await copiedOptions.getFolderNodeNameProcessor()('folder name')).be.exactly('folder name');
    should(await copiedOptions.getAssetNodeNameProcessor()('asset#name')).be.exactly('asset#name');

    fileOptions = new FileSystemUploadOptions()
      .withFolderNodeNameProcessor('invalid')
      .withAssetNodeNameProcessor('invalid')
      .withInvalidCharacterReplaceValue(() => {})
      .withHttpProxy(new HttpProxy('http://reallyfakehostname'));
    copiedOptions = FileSystemUploadOptions.fromOptions(fileOptions);
    should(copiedOptions).be.ok();
    should(copiedOptions.getHttpProxy()).be.ok();
    should(copiedOptions.getInvalidCharacterReplaceValue()).be.exactly('-');
    should(await copiedOptions.getFolderNodeNameProcessor()('folder name')).be.exactly('folder-name');
    should(await copiedOptions.getAssetNodeNameProcessor()('asset#name')).be.exactly('asset-name');
  });

  it('test folder node name processor', async () => {
    should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('a-b');
    should(await options.getFolderNodeNameProcessor()('###')).be.exactly('---');
    options.withInvalidCharacterReplaceValue('_');
    should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('a_b');

    options.withFolderNodeNameProcessor(async (folderName) => folderName.replace('A', 'B'));

    should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('B#b');
  });

  it('test asset node name processor', async () => {
    should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('A-b');
    options.withInvalidCharacterReplaceValue('_');
    should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('A_b');

    options.withAssetNodeNameProcessor(async (assetName) => assetName.replace('A', 'B'));

    should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('B#b');
  });

  it('test invalid replace character', () => {
    should.throws(() => {
      options.withInvalidCharacterReplaceValue(':');
    });
  });
});
