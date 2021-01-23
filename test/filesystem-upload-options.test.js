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

const { importFile } = require('./testutils');

const FileSystemUploadOptions = importFile('filesystem-upload-options');

describe('FileSystemUploadOptions Tests', function() {
    let options;
    beforeEach(function() {
        options = new FileSystemUploadOptions();
    });

    it('test folder node name processor', async function () {
        should(await options.getFolderNodeNameProcessor()('A#b')).be.exactly('a-b');
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
