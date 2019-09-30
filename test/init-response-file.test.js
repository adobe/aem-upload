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

const should = require('should');

const { importFile } = require('./testutils');

const InitResponseFile = importFile('init-response-file');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadFile = importFile('upload-file');

describe('InitResponseFileTest', () => {
    it('smoke test', () => {
        const globalOptions = {};
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://smoketestresfile/somefolder');
        const resFile = new InitResponseFile(
            globalOptions,
            uploadOptions,
            new UploadFile(globalOptions, uploadOptions, {
                fileName: 'testfile.jpg',
                fileSize: 5,
                blob: ['h', 'e', 'l', 'l', 'o'],
            }),
            {
                uploadURIs: ['http://smoketestresfile/1', 'http://smoketestresfile/2'],
                uploadToken: 'token',
                fileName: 'testfile.jpg',
                mimeType: 'image/jpeg',
                maxPartSize: 10,
                minPartSize: 1,
            });

        const uploadUris = resFile.getUploadUris();
        should(uploadUris.length).be.exactly(2);
        should(uploadUris[0]).be.exactly('http://smoketestresfile/1');
        should(uploadUris[1]).be.exactly('http://smoketestresfile/2');

        should(resFile.getUploadToken()).be.exactly('token');
        should(resFile.getTargetFilePath()).be.exactly('/somefolder/testfile.jpg');
        should(resFile.getFileName()).be.exactly('testfile.jpg');
        should(resFile.getFileSize()).be.exactly(5);
        should(resFile.getMimeType()).be.exactly('image/jpeg');
        should(resFile.getMaxPartSize()).be.exactly(10);
        should(resFile.getMinPartSize()).be.exactly(1);

        const parts = resFile.getParts();
        should(parts.length).be.exactly(2);
        should(parts[0].getStartOffset()).be.exactly(0);
        should(parts[0].getEndOffset()).be.exactly(3);
        should(parts[0].getUrl()).be.exactly(uploadUris[0]);
        should(parts[1].getStartOffset()).be.exactly(3);
        should(parts[1].getEndOffset()).be.exactly(5);
        should(parts[1].getUrl()).be.exactly(uploadUris[1]);

        should(resFile.getPartSize()).be.exactly(3);

        const chunk = resFile.getFileChunk(0, 3);
        should(chunk.length).be.exactly(3);
        should(chunk.join('')).be.exactly('hel');
    });
});