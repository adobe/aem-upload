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

const { cleanFolderName, cleanAssetName } = importFile('filesystem-upload-utils');
const FileSystemUploadOptions = importFile('filesystem-upload-options');

describe('FileSystemUploadUtils Tests', function() {
    let options;
    beforeEach(function() {
        options = new FileSystemUploadOptions();
    });

    it('test clean folder name', async function () {
        should(await cleanFolderName(options, 'A b:c')).be.exactly('a-b-c');
        options.withFolderNodeNameProcessor(async (folderName) => folderName)
            .withInvalidCharacterReplaceValue('_');
        should(await cleanFolderName(options, 'A b:c')).be.exactly('A b_c');
    });

    it('test clean asset name', async function () {
        should(await cleanAssetName(options, 'A #b:c.jpg')).be.exactly('A -b-c.jpg');
        options.withAssetNodeNameProcessor(async (assetName) => assetName)
            .withInvalidCharacterReplaceValue('_');
        should(await cleanAssetName(options, 'A #b:c')).be.exactly('A #b_c');
    });
});
