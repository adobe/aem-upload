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

const InitResponse = importFile('init-response');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadFile = importFile('upload-file');

describe('InitResponseTest', () => {
    it.only('test get all parts', () => {
        const uploadFiles = [];
        const completeURI = 'http://unittestupload.com/￡‰§№￠℡㈱/￡‰§№￠℡㈱.jpg';

        for (let i = 0; i < 10; i += 1) {
            const fileName = `testfile${i}.jpg`;
            uploadFiles.push({
                fileName,
                fileSize: 1024,
                filePath: `/${fileName}`
            });
        }

        const options = {};
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://unittestupload.com')
            .withUploadFiles(uploadFiles);

        const uploadFileInstances = [];
        const initData = {
            files: [],
            completeURI
        }
        uploadOptions.getUploadFiles().forEach(uploadFile => {
            const { fileName } = uploadFile;
            const uploadURIs = [];

            for (let i = 0; i < 10; i += 1) {
                uploadURIs.push(`http://unittestupload.com/${fileName}/${i}`);
            }

            uploadFileInstances.push(new UploadFile(options, uploadOptions, uploadFile));
            initData.files.push({
                uploadURIs,
                uploadToken: `token_${fileName}`,
                fileName,
                mimeType: 'image/jpeg'
            });
        });

        const initResponse = new InitResponse(options, uploadOptions, uploadFileInstances, initData);
        const parts = initResponse.getAllParts();
        should(parts.length).be.exactly(100);

        parts.forEach((part, partIndex) => {
            const fileName = `testfile${Math.floor(partIndex / 10)}.jpg`;
            should(part.getFileName()).be.exactly(fileName);
            should(part.getUrl()).be.exactly(`http://unittestupload.com/${fileName}/${partIndex % 10}`);
        });
        should(initResponse.getCompleteUri()).be.exactly(encodeURI(completeURI));
    });
});