/*
Copyright 2022 Adobe. All rights reserved.
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

const InitResponseFileInfo = importFile('init-response-file-info');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadFile = importFile('upload-file');

describe('InitResponseFileInfo Tests', function() {
    it('test get target file path', function() {
        const options = {};
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://somereallyfakeunittesturl/content/dam/test%20path');
        const rawFileData = {
            fileName: 'asset.jpg',
            fileSize: 1024,
            filePath: '/local/test/asset.jpg',
        };
        const uploadFile = new UploadFile(options, uploadOptions, rawFileData);
        const fileInfo = new InitResponseFileInfo(options, uploadOptions, uploadFile, rawFileData);
        should(fileInfo.getTargetFilePath()).be.exactly('/content/dam/test path/asset.jpg');
    });
});
