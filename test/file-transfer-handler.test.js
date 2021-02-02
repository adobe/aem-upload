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

const { createFile  } = require('./test-object-helper');
const { importFile, getTestOptions } = require('./testutils');
const PartUploadResult = importFile('part-upload-result');
const HttpClient = importFile('http/http-client');
const FileTransferHandler = importFile('file-transfer-handler');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadResult = importFile('upload-result');
const { setTimeoutPromise } = importFile('utils');

const FILE_NAME = 'testfile.jpg';
const FILE_PATH = `/content/dam/${FILE_NAME}`;

describe('FileTransferHandler tests', function() {
    let handler = false;
    let allFileParts = [];
    let initResponseFileInfo = false;
    let options = false;
    let uploadOptions = false;
    let httpClient = false;
    let transferStarted = [];
    let transferProgress = [];
    let transferCancelled = [];
    let transferError = [];
    let transferSuccess = [];

    beforeEach(function() {
        options = getTestOptions();
        uploadOptions = new DirectBinaryUploadOptions();
        httpClient = new HttpClient(options, uploadOptions);
        handler = new FileTransferHandler(options, uploadOptions, httpClient);
        const file = createFile(options, uploadOptions, `/${FILE_NAME}`, 'testing', 2);
        allFileParts = file.getParts();
        initResponseFileInfo = allFileParts[0];
        transferStarted = [];
        transferProgress = [];
        transferCancelled = [];
        transferError = [];
        transferSuccess = [];
    
        handler._doFileTransferStarted = async(fileUploadResult, fileInfo) => {
            transferStarted.push({
                fileUploadResult,
                initResponseFileInfo: fileInfo
            });
        };

        handler._doFileTransferProgress = async(fileUploadResult, fileInfo, progressInfo) => {
            transferProgress.push({
                fileUploadResult,
                initResponseFileInfo: fileInfo,
                ...progressInfo,
            });
        };

        handler._doFileTransferCancelled = async(fileUploadResult, fileInfo) => {
            transferCancelled.push({
                fileUploadResult,
                initResponseFileInfo: fileInfo
            })
        };

        handler._doFileTransferError = async(fileUploadResult, fileInfo, errors) => {
            transferError.push({
                fileUploadResult,
                initResponseFileInfo: fileInfo,
                errors
            })
        };

        handler._doFileTransferSucceeded = async(fileUploadResult, fileInfo) => {
            transferSuccess.push({
                fileUploadResult,
                initResponseFileInfo: fileInfo
            })
        };
    });

    it('test part transfer started', async function() {
        const uploadResult = new UploadResult(options, uploadOptions);
        let started = await handler.partTransferStarted(uploadResult, initResponseFileInfo);
        should(started).be.ok();
        should(transferStarted.length).be.exactly(1);

        const { fileUploadResult, initResponseFileInfo: fileInfo } = transferStarted[0];
        should(fileInfo.getFileName()).be.exactly(FILE_NAME);
        should(uploadResult.getFileUploadResults().length).be.exactly(1);
        await setTimeoutPromise(10);
        fileUploadResult.stopTimer();
        should(fileUploadResult.getTotalUploadTime()).be.ok();
        should(fileUploadResult.getFileName()).be.exactly(fileInfo.getFileName());

        // subsequent calls should not add more transferStarted items
        started = await handler.partTransferStarted(uploadResult, initResponseFileInfo);
        should(started).be.ok();
        should(transferStarted.length).be.exactly(1);
    });

    it('test part transfer started cancelled', async function() {
        const uploadResult = new UploadResult(options, uploadOptions);

        httpClient.cancel(FILE_PATH);

        const started = await handler.partTransferStarted(uploadResult, initResponseFileInfo);
        should(started).not.be.ok();
        should(transferStarted.length).be.exactly(0);
        should(uploadResult.getFileUploadResults().length).be.exactly(1);
    });

    it('test part transfer started cancelled after started', async function() {
        const uploadResult = new UploadResult(options, uploadOptions);

        const started = await handler.partTransferStarted(uploadResult, initResponseFileInfo);
        should(started).be.ok();

        httpClient.cancel(FILE_PATH);

        should(await handler.partTransferStarted(uploadResult, initResponseFileInfo)).not.be.ok();
    });

    it('test part transfer started not succcessful', async function() {
        const uploadResult = new UploadResult(options, uploadOptions);

        let startCount = 0;
        handler._doFileTransferStarted = async(fileUploadResult) => {
            fileUploadResult.setCompleteError('there was a problem');
            startCount++;
        };

        const started = await handler.partTransferStarted(uploadResult, initResponseFileInfo);
        should(started).not.be.ok();
        should(startCount).be.exactly(1);

        should(await handler.partTransferStarted(uploadResult, initResponseFileInfo)).not.be.ok();
        should(startCount).be.exactly(1);
    });

    function getTestProgress(index) {
        return { transferred: 100 * index, elapsed: 2000 };
    }

    it('test part transfer progress', async function() {
        await handler.partTransferProgress(initResponseFileInfo, getTestProgress(1));
        should(transferProgress.length).be.exactly(0);

        await handler.partTransferStarted(new UploadResult(options, uploadOptions), initResponseFileInfo);
        await handler.partTransferProgress(initResponseFileInfo, getTestProgress(1));
        should(transferProgress.length).be.exactly(1);

        const { initResponseFileInfo: progressInfo, fileUploadResult, transferred } = transferProgress[0];
        should(progressInfo.getFileName()).be.exactly(FILE_NAME);
        should(fileUploadResult.getFileName()).be.exactly(progressInfo.getFileName());
        should(transferred).be.exactly(100);

        await Promise.all([
            handler.partTransferProgress(initResponseFileInfo, getTestProgress(2)),
            handler.partTransferProgress(initResponseFileInfo, getTestProgress(3)),
            handler.partTransferProgress(initResponseFileInfo, getTestProgress(4)),
        ]);
        should(transferProgress.length).be.exactly(1);

        await setTimeoutPromise(501);
        await handler.partTransferProgress(initResponseFileInfo, getTestProgress(5));
        should(transferProgress.length).be.exactly(2);

        const { transferred: transferred2 } = transferProgress[1];
        should(transferred2).be.exactly(1500);
    });

    it('test part transfer ended', async function() {
        await handler.partTransferEnded(initResponseFileInfo, new PartUploadResult(options, uploadOptions, initResponseFileInfo));
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(0);

        await handler.partTransferStarted(new UploadResult(options, uploadOptions), allFileParts[0]);
        await handler.partTransferEnded(allFileParts[0], new PartUploadResult(options, uploadOptions, allFileParts[0]));
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(0);

        await handler.partTransferEnded(allFileParts[1], new PartUploadResult(options, uploadOptions, allFileParts[1]));
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(1);

        const { fileUploadResult, initResponseFileInfo: fileInfo } = transferSuccess[0];
        should(fileUploadResult.getFileName()).be.exactly(FILE_NAME);
        should(fileInfo.getFileName()).be.exactly(fileUploadResult.getFileName());
        should(fileUploadResult.getErrors().length).be.exactly(0);
        should(fileUploadResult.isCancelled()).not.be.ok();
        should(fileUploadResult.getPartUploadResults().length).be.exactly(2);

        await handler.partTransferEnded(allFileParts[1], new PartUploadResult(options, uploadOptions, allFileParts[1]));
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(1);
    });

    it('test part transfer ended cancelled', async function() {
        await handler.partTransferStarted(new UploadResult(options, uploadOptions), allFileParts[0]);

        httpClient.cancel(FILE_PATH);
        const partResult = new PartUploadResult(options, uploadOptions, allFileParts[0]);
        partResult.setError('there was an error!');

        await handler.partTransferEnded(allFileParts[0], partResult);
        should(transferCancelled.length).be.exactly(1);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(0);

        const { fileUploadResult, initResponseFileInfo: fileInfo } = transferCancelled[0];
        should(fileUploadResult.getFileName()).be.exactly(FILE_NAME);
        should(fileInfo.getFileName()).be.exactly(fileUploadResult.getFileName());
        should(fileUploadResult.isCancelled()).be.ok();

        await handler.partTransferEnded(allFileParts[1], new PartUploadResult(options, uploadOptions, allFileParts[1]));
        should(transferCancelled.length).be.exactly(1);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(0);

        // try sending progress after the file has ended
        await handler.partTransferProgress(allFileParts[1], 100);
        should(transferCancelled.length).be.exactly(1);
        should(transferError.length).be.exactly(0);
        should(transferSuccess.length).be.exactly(0);
        should(transferProgress.length).be.exactly(0);
    });

    it('test part transfer ended error', async function() {
        await handler.partTransferStarted(new UploadResult(options, uploadOptions), allFileParts[0]);

        const partResult = new PartUploadResult(options, uploadOptions, allFileParts[0]);
        partResult.setError('there was an error!');

        await handler.partTransferEnded(allFileParts[0], partResult);
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(1);
        should(transferSuccess.length).be.exactly(0);

        const { fileUploadResult, initResponseFileInfo: fileInfo } = transferError[0];
        should(fileUploadResult.getFileName()).be.exactly(FILE_NAME);
        should(fileInfo.getFileName()).be.exactly(fileUploadResult.getFileName());
        should(fileUploadResult.isCancelled()).not.be.ok();
        should(fileUploadResult.isSuccessful()).not.be.ok();
        should(fileUploadResult.getErrors().length).be.exactly(1);
        should(fileUploadResult.getPartUploadResults().length).be.exactly(1);

        await handler.partTransferEnded(allFileParts[1], false);
        should(transferCancelled.length).be.exactly(0);
        should(transferError.length).be.exactly(1);
        should(transferSuccess.length).be.exactly(0);
        should(fileUploadResult.getPartUploadResults().length).be.exactly(1);
    });
});
