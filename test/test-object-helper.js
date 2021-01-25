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

const mime = require('mime');
const Url = require('url');
const Path = require('path');

const { importFile } = require('./testutils');
const MockRequest = require('./mock-request');
const InitResponseFile = importFile('init-response-file');
const UploadFile = importFile('upload-file');
const { normalizePath } = importFile('utils');

/**
 * Creates an InitResponseFile instance that can be used with the mock test framework.
 * @param {object} options Overall direct upload options to use.
 * @param {DirectBinaryUploadOptions} uploadOptions Options specific to the current
 *  upload.
 * @param {string} remotePath Absolute remote path *only* where the file should be
 *  uploaded. Should not include /content/dam. Example: /myfolder/myasset.jpg.
 * @param {*} fileData Raw value to use as the file's content.
 * @param {number} [partCount] The number of parts to divide the file into. Default: 1.
 * @returns {InitResponseFile} New instance representing the file.
 */
function createFile(options, uploadOptions, remotePath, fileData, partCount = 1) {
    const uploadURIs = [];

    const folderPath = normalizePath(Path.dirname(remotePath));
    const fileName = Path.basename(remotePath);

    const folderUrl = MockRequest.getUrl(folderPath);
    uploadOptions.withUrl(folderUrl);
    for (let i = 0; i < partCount; i++) {
        const uploadUri = MockRequest.getPartUrl(folderPath, fileName, i);
        uploadURIs.push(uploadUri);
    }

    return new InitResponseFile(options, uploadOptions, new UploadFile(options, uploadOptions, {
        fileName,
        fileSize: fileData.length,
        blob: fileData
    }), {
        uploadURIs,
        uploadToken: MockRequest.getUploadToken(fileName),
        fileName,
        mimeType: mime.getType(fileName),
        maxPartSize: 10000000,
        minPartSize: 1000000
    });
}

module.exports = {
    createFile
};
