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
const querystring = require('querystring');

const { importFile, getTestOptions } = require('./testutils');
const MockRequest = require('./mock-request');
const MockBlob = require('./mock-blob');

const DirectBinaryUpload = importFile('direct-binary-upload');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const ErrorCodes = importFile('error-codes');

let blob1, blob2, events;
function getTestUploadFiles() {
    blob1 = new MockBlob();
    blob2 = new MockBlob();
    return [{
        fileName: 'targetfile.jpg',
        fileSize: 1024,
        blob: blob1,
    }, {
        fileName: 'targetfile2.jpg',
        fileSize: 1999,
        blob: blob2,
    }];
}

function verifyFile1Event(eventName, eventData, folderName = 'folder') {
    const event = eventData.data;
    should(eventData.event).be.exactly(eventName);
    should(event.fileName).be.exactly('targetfile.jpg');
    should(event.fileSize).be.exactly(1024);
    should(event.targetFolder).be.exactly(`/content/dam/target/${folderName}`);
    should(event.targetFile).be.exactly(`/content/dam/target/${folderName}/targetfile.jpg`);
    should(event.mimeType).be.exactly('image/jpeg');

    if (eventName === 'fileprogress') {
        should(event.transferred).be.greaterThan(0);
    }
    if (eventName === 'fileerror') {
        should(event.errors.length).be.greaterThan(0);
    }
}

function verifyFile2Event(eventName, eventData, folderName = 'folder') {
    const event = eventData.data;
    should(eventData.event).be.exactly(eventName);
    should(event.fileName).be.exactly('targetfile2.jpg');
    should(event.fileSize).be.exactly(1999);
    should(event.targetFolder).be.exactly(`/content/dam/target/${folderName}`);
    should(event.targetFile).be.exactly(`/content/dam/target/${folderName}/targetfile2.jpg`);
    should(event.mimeType).be.exactly('image/jpeg');

    if (eventName === 'fileprogress') {
        should(event.transferred).be.greaterThan(0);
    }
    if (eventName === 'fileerror') {
        should(event.errors.length).be.greaterThan(0);
    }
}

function monitorEvents(upload) {
    upload.on('filestart', data => {
        events.push({ event: 'filestart', data });
    });
    upload.on('fileend', data => {
        events.push({ event: 'fileend', data });
    });
    upload.on('fileprogress', data => {
        events.push({ event: 'fileprogress', data });
    });
    upload.on('fileerror', data => {
        events.push({ event: 'fileerror', data });
    });
    upload.on('filecancelled', data => {
        events.push({ event: 'filecancelled', data });
    });
}

describe('DirectBinaryUploadTest', () => {
    beforeEach(() => {
        MockRequest.reset();
        events = [];
    });

    describe('uploadFiles', () => {
        it('direct upload smoke test', async () => {
            MockRequest.addDirectUpload('/target/folder');
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl('/target/folder'))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false);

            const upload = new DirectBinaryUpload(getTestOptions());
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);
            should(result).be.ok();

            // verify that upload is correct
            const directUploads = MockRequest.getDirectUploads();
            should(directUploads.length).be.exactly(1);
            should(directUploads[0].uploadFiles.length).be.exactly(2);

            const uploadFile1 = directUploads[0].uploadFiles[0];
            const uploadFile2 = directUploads[0].uploadFiles[1];

            should(uploadFile1.fileUrl).be.exactly(`${MockRequest.getUrl('/target/folder/targetfile.jpg')}`);
            should(uploadFile1.fileSize).be.exactly(1024);
            should(uploadFile2.fileUrl).be.exactly(`${MockRequest.getUrl('/target/folder/targetfile2.jpg')}`);
            should(uploadFile2.fileSize).be.exactly(1999);

            // verify return value
            should(result.getTotalFiles()).be.exactly(2);
            should(result.getTotalCompletedFiles()).be.exactly(2);
            should(result.getElapsedTime()).be.greaterThan(0);
            should(result.getTotalSize()).be.exactly(3023);
            should(result.getAverageFileSize()).be.exactly(1512);
            should(result.getAverageFileUploadTime()).be.greaterThan(0);
            should(result.getAveragePartUploadTime()).be.greaterThan(0);
            should(result.getAverageCompleteTime()).be.greaterThan(0);
            should(result.getNinetyPercentileTotal()).be.greaterThan(0);
            should(result.getErrors().length).be.exactly(0);

            const fileResults = result.getFileUploadResults();
            should(fileResults.length).be.exactly(2);

            let file1 = fileResults[0];
            let file2 = fileResults[1];

            if (file1.getFileName() !== 'targetfile.jpg') {
                let tempFile = file1;
                file1 = file2;
                file2 = tempFile;
            }

            should(file1.getFileName()).be.exactly('targetfile.jpg');
            should(file1.getFileSize()).be.exactly(1024);
            should(file1.getPartCount()).be.exactly(1);
            should(file1.getTotalUploadTime()).be.greaterThan(0);
            should(file1.getFastestPartUploadTime()).be.greaterThan(0);
            should(file1.getSlowestPartUploadTime()).be.greaterThan(0);
            should(file1.getSlowestPartUploadTime()).be.greaterThanOrEqual(file1.getFastestPartUploadTime());
            should(file1.getAveragePartUploadTime()).be.greaterThan(0);
            should(file1.getTotalCompleteTime()).be.greaterThan(0);
            should(file1.isSuccessful()).be.ok();
            should(file1.getErrors().length).not.be.ok();
            should(file1.isCancelled()).not.be.ok();

            const file1Parts = file1.getPartUploadResults();
            should(file1Parts.length).be.exactly(1);

            const file1Part1 = file1Parts[0];

            should(file1Part1.getStartOffset()).be.exactly(0);
            should(file1Part1.getEndOffset()).be.exactly(1024);
            should(file1Part1.getUrl()).be.exactly('<handled by httptransfer>');
            should(file1Part1.getUploadTime()).be.greaterThan(0);
            should(file1Part1.isSuccessful()).be.ok();
            should(file1Part1.getError()).not.be.ok();

            // verify second file
            should(file2.getFileName()).be.exactly('targetfile2.jpg');
            should(file2.getFileSize()).be.exactly(1999);
            should(file2.getPartCount()).be.exactly(1);
            should(file2.getTotalUploadTime()).be.greaterThan(0);
            should(file2.getFastestPartUploadTime()).be.greaterThan(0);
            should(file2.getSlowestPartUploadTime()).be.greaterThan(0);
            should(file2.getSlowestPartUploadTime()).be.greaterThanOrEqual(file2.getFastestPartUploadTime());
            should(file2.getAveragePartUploadTime()).be.greaterThan(0);
            should(file2.getTotalCompleteTime()).be.greaterThan(0);
            should(file2.isSuccessful()).be.ok();
            should(file2.getErrors().length).not.be.ok();
            should(file2.isCancelled()).not.be.ok();

            const file2Parts = file2.getPartUploadResults();
            should(file2Parts.length).be.exactly(1);

            const file2Part1 = file2Parts[0];

            should(file2Part1.getStartOffset()).be.exactly(0);
            should(file2Part1.getEndOffset()).be.exactly(1999);
            should(file2Part1.getUrl()).be.exactly('<handled by httptransfer>');
            should(file2Part1.getUploadTime()).be.greaterThan(0);
            should(file2Part1.isSuccessful()).be.ok();
            should(file2Part1.getError()).not.be.ok();

            // verify that events are correct
            should(events.length).be.exactly(6);
            verifyFile1Event('filestart', events[0]);
            verifyFile1Event('fileprogress', events[1]);
            verifyFile1Event('fileend', events[2]);
            verifyFile2Event('filestart', events[3]);
            verifyFile2Event('fileprogress', events[4]);
            verifyFile2Event('fileend', events[5]);
        });

        it('progress events', async() => {
            const targetFolder = '/target/progress_events';
            MockRequest.addDirectUpload(targetFolder);

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false);

            const upload = new DirectBinaryUpload({
                ...getTestOptions(),
                progressDelay: 0
            });
            monitorEvents(upload);

            await upload.uploadFiles(options);

            should(events.length).be.exactly(6);

            should(events[0].event).be.exactly('filestart');
            should(events[0].data.fileName).be.exactly('targetfile.jpg');
            should(events[1].event).be.exactly('fileprogress');
            should(events[1].data.fileName).be.exactly('targetfile.jpg');
            should(events[1].data.transferred).be.exactly(512);
            should(events[2].event).be.exactly('fileend');
            should(events[2].data.fileName).be.exactly('targetfile.jpg');

            should(events[3].event).be.exactly('filestart');
            should(events[3].data.fileName).be.exactly('targetfile2.jpg');
            should(events[4].event).be.exactly('fileprogress');
            should(events[4].data.fileName).be.exactly('targetfile2.jpg');
            should(events[4].data.transferred).be.exactly(512);
            should(events[5].event).be.exactly('fileend');
            should(events[5].data.fileName).be.exactly('targetfile2.jpg');
        });

        it('direct binary not supported', async() => {
            const targetFolder = '/target/folder_not_supported';
            MockRequest.addDirectUpload(targetFolder);

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false)
                .withHttpRetryCount(1);

            const upload = new DirectBinaryUpload(getTestOptions());
            await upload.canUpload(options);

            MockRequest.onInit(targetFolder, () => {
                return new Promise(resolve => {
                    resolve([501]);
                });
            });

            let threw = false;
            try {
                await upload.canUpload(options);
            } catch (e) {
                should(e).be.ok();
                should(e.getCode()).be.exactly(ErrorCodes.NOT_SUPPORTED);
                threw = true;
            }
            should(threw).be.ok();
        });
    });
});
