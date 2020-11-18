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

const { importFile, getTestOptions } = require('./testutils');
const { createFile } = require('./test-object-helper');
const HttpClient = importFile('http/http-client');
const PartUploader = importFile('part-uploader');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadResult = importFile('upload-result');
const MockRequest = require('./mock-request');
const ConcurrentQueue = importFile('concurrent-queue');
const FileTransferHandler = importFile('file-transfer-handler');

describe('Part Uploader Tests', function() {
    let options = false;
    let uploadOptions = false;
    let uploadResult = false;
    let httpClient = false;
    let uploader = false;
    let fileTransferHandler = false;
    let events = [];

    function registerEvent(eventName, fileUploadResult, initResponseFileInfo) {
        events.push({
            eventName,
            fileUploadResult,
            initResponseFileInfo
        })
    }

    beforeEach(function() {
        MockRequest.reset();
        options = getTestOptions();
        events = [];
        uploadOptions = new DirectBinaryUploadOptions();
        uploadResult = new UploadResult(options, uploadOptions);
        httpClient = new HttpClient(options, uploadOptions);
        uploader = new PartUploader(options, uploadOptions, httpClient, new ConcurrentQueue(options, uploadOptions));
        fileTransferHandler = new FileTransferHandler(options, uploadOptions, httpClient);

        fileTransferHandler._doFileTransferSucceeded = (fileUploadResult, initResponseFileInfo) => registerEvent('fileend', fileUploadResult, initResponseFileInfo);
        fileTransferHandler._doFileTransferError = (fileUploadResult, initResponseFileInfo) => registerEvent('fileerror', fileUploadResult, initResponseFileInfo);
        fileTransferHandler._doFileTransferCancelled = (fileUploadResult, initResponseFileInfo) => registerEvent('filecancelled', fileUploadResult, initResponseFileInfo);
        fileTransferHandler._doFileTransferStarted = (fileUploadResult, initResponseFileInfo) => registerEvent('filestart', fileUploadResult, initResponseFileInfo);
        fileTransferHandler._doFileTransferProgress = (fileUploadResult, initResponseFileInfo) => registerEvent('fileprogress', fileUploadResult, initResponseFileInfo);
    });

    it('upload parts smoke test', async function() {
        const file = createFile(options, uploadOptions, '/myfile.jpg', 'hello', 2);
        const parts = file.getParts();

        for (let i = 0; i < parts.length; i++) {
            MockRequest.onPut(parts[i].getUrl()).reply(MockRequest.withDelay(100, [201, {}]));
        }

        await uploader.uploadParts(uploadResult, parts, fileTransferHandler);
        should(uploadResult.getErrors().length).be.exactly(0);
        should(uploadResult.getFileUploadResults().length).be.exactly(1);
        should(uploadResult.getFileUploadResults()[0].getPartUploadResults().length).be.exactly(2);
        should(uploadResult.getFileUploadResults()[0].getPartUploadResults()[0].getUploadTime()).be.ok();

        should(events.length).be.exactly(2);
        should(events[0].eventName).be.exactly('filestart');
        should(events[0].initResponseFileInfo).be.ok();
        should(events[0].fileUploadResult).be.ok();
        should(events[0].initResponseFileInfo.getFileName()).be.exactly('myfile.jpg');

        should(events[1].eventName).be.exactly('fileend');
        should(events[1].initResponseFileInfo).be.ok();
        should(events[1].fileUploadResult).be.ok();
        should(events[1].initResponseFileInfo.getFileName()).be.exactly('myfile.jpg');
    });

    it('upload parts part error', async function() {
        const file = createFile(options, uploadOptions, '/errorfile.jpg', 'error', 2);

        await uploader.uploadParts(uploadResult, file.getParts(), fileTransferHandler);

        should(events.length).be.exactly(2);
        should(events[0].eventName).be.exactly('filestart');
        should(events[1].eventName).be.exactly('fileerror');
        should(uploadResult.getErrors().length).be.exactly(1);
    });
});
