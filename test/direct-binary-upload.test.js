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

const { importFile } = require('./testutils');
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
        it('smoke test', async () => {
            MockRequest.addDirectUpload('/target/folder');
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl('/target/folder'))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false);

            const upload = new DirectBinaryUpload();
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);
            should(result).be.ok();

            // verify that files were sliced correctly
            let slices = blob1.getSlices();
            should(slices.length).be.exactly(2);
            should(slices[0].start).be.exactly(0);
            should(slices[0].end).be.exactly(512);
            should(slices[1].start).be.exactly(512);
            should(slices[1].end).be.exactly(1024);

            slices = blob2.getSlices();
            should(slices.length).be.exactly(4);
            should(slices[0].start).be.exactly(0);
            should(slices[0].end).be.exactly(500);
            should(slices[1].start).be.exactly(500);
            should(slices[1].end).be.exactly(1000);
            should(slices[2].start).be.exactly(1000);
            should(slices[2].end).be.exactly(1500);
            should(slices[3].start).be.exactly(1500);
            should(slices[3].end).be.exactly(1999);

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(3);
            should(posts[0].url).be.exactly(MockRequest.getUrl('/target/folder.initiateUpload.json'));
            should(posts[1].url).be.exactly(MockRequest.getUrl('/target/folder.completeUpload.json'));
            should(posts[2].url).be.exactly(MockRequest.getUrl('/target/folder.completeUpload.json'));

            const data1 = querystring.parse(posts[1].data);
            const data2 = querystring.parse(posts[2].data);

            if (data1.fileName === 'targetfile.jpg') {
                should(data2.fileName).be.exactly('targetfile2.jpg');
            } else {
                should(data1.fileName).be.exactly('targetfile2.jpg');
                should(data2.fileName).be.exactly('targetfile.jpg');
            }
            should(data1.createVersion).not.be.ok();
            should(data1.replace).not.be.ok();
            should(data1.uploadDuration).be.greaterThan(0);
            should(data2.createVersion).not.be.ok();
            should(data2.replace).not.be.ok();
            should(data2.uploadDuration).be.greaterThan(0);

            // verify that part requests are correct
            const puts = MockRequest.history.put;
            should(puts.length).be.exactly(6);

            const files = MockRequest.getDirectFiles();
            should(Object.keys(files).length).be.exactly(2);
            should(files['/content/dam/target/folder/targetfile.jpg']).be.exactly('0,512,512,1024,');
            should(files['/content/dam/target/folder/targetfile2.jpg']).be.exactly('0,500,500,1000,1000,1500,1500,1999,');

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
            should(file1.getPartCount()).be.exactly(2);
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
            should(file1Parts.length).be.exactly(2);

            const file1Part1 = file1Parts[0];
            const file1Part2 = file1Parts[1];

            should(file1Part1.getStartOffset()).be.exactly(0);
            should(file1Part1.getEndOffset()).be.exactly(512);
            should(file1Part1.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile.jpg.0'));
            should(file1Part1.getUploadTime()).be.greaterThan(0);
            should(file1Part1.isSuccessful()).be.ok();
            should(file1Part1.getError()).not.be.ok();

            should(file1Part2.getStartOffset()).be.exactly(512);
            should(file1Part2.getEndOffset()).be.exactly(1024);
            should(file1Part2.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile.jpg.1'));
            should(file1Part2.getUploadTime()).be.greaterThan(0);
            should(file1Part2.isSuccessful()).be.ok();
            should(file1Part2.getError()).not.be.ok();

            // verify second file
            should(file2.getFileName()).be.exactly('targetfile2.jpg');
            should(file2.getFileSize()).be.exactly(1999);
            should(file2.getPartCount()).be.exactly(4);
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
            should(file2Parts.length).be.exactly(4);

            const file2Part1 = file2Parts[0];
            const file2Part2 = file2Parts[1];
            const file2Part3 = file2Parts[2];
            const file2Part4 = file2Parts[3];

            should(file2Part1.getStartOffset()).be.exactly(0);
            should(file2Part1.getEndOffset()).be.exactly(500);
            should(file2Part1.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile2.jpg.0'));
            should(file2Part1.getUploadTime()).be.greaterThan(0);
            should(file2Part1.isSuccessful()).be.ok();
            should(file2Part1.getError()).not.be.ok();

            should(file2Part2.getStartOffset()).be.exactly(500);
            should(file2Part2.getEndOffset()).be.exactly(1000);
            should(file2Part2.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile2.jpg.1'));
            should(file2Part2.getUploadTime()).be.greaterThan(0);
            should(file2Part2.isSuccessful()).be.ok();
            should(file2Part2.getError()).not.be.ok();

            should(file2Part3.getStartOffset()).be.exactly(1000);
            should(file2Part3.getEndOffset()).be.exactly(1500);
            should(file2Part3.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile2.jpg.2'));
            should(file2Part3.getUploadTime()).be.greaterThan(0);
            should(file2Part3.isSuccessful()).be.ok();
            should(file2Part3.getError()).not.be.ok();

            should(file2Part4.getStartOffset()).be.exactly(1500);
            should(file2Part4.getEndOffset()).be.exactly(1999);
            should(file2Part4.getUrl()).be.exactly(MockRequest.getUrl('/target/folder/targetfile2.jpg.3'));
            should(file2Part4.getUploadTime()).be.greaterThan(0);
            should(file2Part4.isSuccessful()).be.ok();
            should(file2Part4.getError()).not.be.ok();

            // verify that events are correct
            should(events.length).be.exactly(6);
            verifyFile1Event('filestart', events[0]);
            verifyFile1Event('fileprogress', events[1]);
            verifyFile1Event('fileend', events[2]);
            verifyFile2Event('filestart', events[3]);
            verifyFile2Event('fileprogress', events[4]);
            verifyFile2Event('fileend', events[5]);
        });

        it('init failure test', async () => {
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl('/target/folder_init_fail'))
                .withUploadFiles(getTestUploadFiles())
                .withHttpRetryCount(1);

            const upload = new DirectBinaryUpload();

            let uploadErr;
            try {
                await upload.uploadFiles(options);
            } catch (e) {
                uploadErr = e;
            }

            should(uploadErr).be.ok();
            should(uploadErr.getCode()).be.exactly(ErrorCodes.NOT_FOUND);

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(1);
            should(posts[0].url).be.exactly(MockRequest.getUrl('/target/folder_init_fail.initiateUpload.json'));
        });

        function verifyPartialSuccess(result, events, folderName, partSucceeded = false, errorEvent = 'fileerror', errorCode = ErrorCodes.INVALID_OPTIONS) {
            should(result).be.ok();
            should(result.getTotalFiles()).be.exactly(2);
            should(result.getTotalCompletedFiles()).be.exactly(1);
            should(result.getErrors().length).be.exactly(1);

            const fileResults = result.getFileUploadResults();
            should(fileResults.length).be.exactly(2);

            let file1 = fileResults[0];
            let file2 = fileResults[1];

            if (file2.getFileName() === 'targetfile.jpg') {
                const tempFile = file1;
                file1 = file2;
                file2 = tempFile;
            }

            should(file1.isSuccessful()).not.be.ok();
            should(file1.getErrors().length).be.exactly(1);
            should(file1.getErrors()[0].getCode()).be.exactly(errorCode);

            const file1Parts = file1.getPartUploadResults();
            const part1 = file1Parts[0];
            const part2 = file1Parts[1];

            if (partSucceeded) {
                should(part1.isSuccessful()).be.ok();
                should(part1.getError()).not.be.ok();
                should(part2.isSuccessful()).be.ok();
                should(part2.getError()).not.be.ok();
            } else {
                should(part1.isSuccessful()).not.be.ok();
                should(part1.getError()).be.ok();
            }

            should(file2.isSuccessful()).be.ok();
            should(file2.getErrors().length).not.be.ok();

            should(result.getAverageFileUploadTime()).be.exactly(file2.getTotalUploadTime());
            should(result.getAveragePartUploadTime()).be.exactly(file2.getAveragePartUploadTime());
            should(result.getAverageCompleteTime()).be.exactly(file2.getTotalCompleteTime());
            should(result.getNinetyPercentileTotal()).be.exactly(file2.getTotalUploadTime() + file2.getTotalCompleteTime());

            // verify events
            should(events.length).be.exactly(6);
            verifyFile1Event('filestart', events[0], folderName);
            verifyFile1Event('fileprogress', events[1], folderName);
            verifyFile1Event(errorEvent, events[2], folderName);
            verifyFile2Event('filestart', events[3], folderName);
            verifyFile2Event('fileprogress', events[4], folderName);
            verifyFile2Event('fileend', events[5], folderName);
        }

        it('part failure test', async() => {
            const targetFolder = '/target/folder_part_fail';
            MockRequest.addDirectUpload(targetFolder);
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false)
                .withHttpRetryCount(1);

            MockRequest.onPart(targetFolder, 'targetfile.jpg', '0', () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([400]);
                    }, 300);
                });
            });

            const upload = new DirectBinaryUpload();
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);
            verifyPartialSuccess(result, events, 'folder_part_fail');

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(2);
            should(posts[0].url).be.exactly(MockRequest.getUrl(`${targetFolder}.initiateUpload.json`));
            should(posts[1].url).be.exactly(MockRequest.getUrl(`${targetFolder}.completeUpload.json`));
        });

        it('complete failure test', async() => {
            const targetFolder = '/target/folder_complete_fail';
            MockRequest.addDirectUpload(targetFolder);
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false)
                .withHttpRetryCount(1);

            MockRequest.onComplete(targetFolder, 'targetfile.jpg', async () => {
                return [400];
            });

            const upload = new DirectBinaryUpload();
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);
            verifyPartialSuccess(result, events, 'folder_complete_fail', true);

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(3);
            should(posts[0].url).be.exactly(MockRequest.getUrl(`${targetFolder}.initiateUpload.json`));
            should(posts[1].url).be.exactly(MockRequest.getUrl(`${targetFolder}.completeUpload.json`));
            should(posts[2].url).be.exactly(MockRequest.getUrl(`${targetFolder}.completeUpload.json`));
        });

        it('cancel file upload', async() => {
            const targetFolder = '/target/folder_cancel_file';
            MockRequest.addDirectUpload(targetFolder);

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false);

            const controller = options.getController();

            MockRequest.onPart(targetFolder, 'targetfile.jpg', '0', () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        controller.cancelFile('targetfile.jpg');
                        resolve([201]);
                    }, 300);
                });
            });

            const upload = new DirectBinaryUpload();
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);
            verifyPartialSuccess(result, events, 'folder_cancel_file', false, 'filecancelled', ErrorCodes.USER_CANCELLED);

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(2);
            should(posts[0].url).be.exactly(MockRequest.getUrl(`${targetFolder}.initiateUpload.json`));
            should(posts[1].url).be.exactly(MockRequest.getUrl(`${targetFolder}.completeUpload.json`));
        });

        it('cancel all uploads', async() => {
            const targetFolder = '/target/folder_cancel_all';
            MockRequest.addDirectUpload(targetFolder);

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles(getTestUploadFiles())
                .withConcurrent(false);

            const controller = options.getController();

            MockRequest.onPart(targetFolder, 'targetfile.jpg', '0', () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        controller.cancel();
                        resolve([201]);
                    }, 300);
                });
            });

            const upload = new DirectBinaryUpload();
            monitorEvents(upload);

            const result = await upload.uploadFiles(options);

            should(result.getTotalCompletedFiles()).be.exactly(0);
            should(result.getFileUploadResults().length).be.exactly(2);
            should(result.getFileUploadResults()[0].isCancelled()).be.ok();
            should(result.getFileUploadResults()[1].isCancelled()).be.ok();

            should(events.length).be.exactly(4);
            should(events[0].event).be.exactly('filestart');
            should(events[0].data.fileName).be.exactly('targetfile.jpg');
            should(events[1].event).be.exactly('fileprogress');
            should(events[1].data.fileName).be.exactly('targetfile.jpg');
            should(events[2].event).be.exactly('filecancelled');
            should(events[2].data.fileName).be.exactly('targetfile.jpg');
            should(events[3].event).be.exactly('filecancelled');
            should(events[3].data.fileName).be.exactly('targetfile2.jpg');

            // verify that init/complete requests are correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(1);
            should(posts[0].url).be.exactly(MockRequest.getUrl(`${targetFolder}.initiateUpload.json`));
        });
    });
});
