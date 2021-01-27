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

const should = require('should');

const { importFile } = require('./testutils');

const FileSystemUploadOptions = importFile('filesystem-upload-options');

describe('FileSystemUploadOptions Tests', function() {
    let options;
    beforeEach(function() {
        options = new FileSystemUploadOptions();
    });

    it('test from options', async function() {
        let options = new FileSystemUploadOptions()
            .withMaxUploadFiles(20)
            .withDeepUpload(true)
            .withFolderNodeNameProcessor(async (name) => name)
            .withAssetNodeNameProcessor(async (name) => name)
            .withInvalidCharacterReplaceValue('_');
        let copiedOptions = FileSystemUploadOptions.fromOptions(options);
        should(copiedOptions).be.ok();
        should(copiedOptions.getInvalidCharacterReplaceValue()).be.exactly('_');
        should(copiedOptions.getMaxUploadFiles()).be.exactly(20);
        should(copiedOptions.getDeepUpload()).be.ok();
        should(await copiedOptions.getFolderNodeNameProcessor()('folder name')).be.exactly('folder name');
        should(await copiedOptions.getAssetNodeNameProcessor()('asset#name')).be.exactly('asset#name');

        options = new FileSystemUploadOptions()
            .withFolderNodeNameProcessor('invalid')
            .withAssetNodeNameProcessor('invalid')
            .withInvalidCharacterReplaceValue(() => {});
        copiedOptions = FileSystemUploadOptions.fromOptions(options);
        should(copiedOptions).be.ok();
        should(copiedOptions.getInvalidCharacterReplaceValue()).be.exactly('-');
        should(await copiedOptions.getFolderNodeNameProcessor()('folder name')).be.exactly('folder-name');
        should(await copiedOptions.getAssetNodeNameProcessor()('asset#name')).be.exactly('asset-name');
    });

    it('test folder node name processor', async function () {
        should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('a-b');
        should(await options.getFolderNodeNameProcessor()('###')).be.exactly('---');
        options.withInvalidCharacterReplaceValue('_');
        should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('a_b');

        options.withFolderNodeNameProcessor(async (folderName) => {
            return folderName.replace('A', 'B');
        });

        should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('B#b');
    });

    it('test asset node name processor', async function () {
        should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('A-b');
        options.withInvalidCharacterReplaceValue('_');
        should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('A_b');

        options.withAssetNodeNameProcessor(async (assetName) => {
            return assetName.replace('A', 'B');
        });

        should(await options.getAssetNodeNameProcessor()('A#b')).be.exactly('B#b');
    });

    it('test invalid replace character', function() {
        should.throws(function() {
            options.withInvalidCharacterReplaceValue(':');
        });
    });
});
