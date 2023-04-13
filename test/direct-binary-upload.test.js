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

const { importFile, getTestOptions, verifyResult } = require('./testutils');
const MockRequest = require('./mock-request');
const MockBlob = require('./mock-blob');

const DirectBinaryUpload = importFile('direct-binary-upload');
const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');

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
    upload.on('fileuploadstart', data => {
        events.push({ event: 'fileuploadstart', data });
    });
    upload.on('fileuploadend', data => {
        events.push({ event: 'fileuploadend', data });
    });
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
            verifyResult(result, {
                host: 'http://localhost',
                totalFiles: 2,
                totalTime: result.totalTime,
                totalCompleted: 2,
                totalFileSize: 3023,
                folderCreateSpent: 0,
                createdFolders: [],
                detailedResult: [{
                    fileUrl: 'http://localhost/content/dam/target/folder/targetfile.jpg',
                    fileSize: 1024,
                    blob: '<provided>',
                    result: {
                        fileName: 'targetfile.jpg',
                        fileSize: 1024,
                        targetFolder: '/content/dam/target/folder',
                        targetFile: '/content/dam/target/folder/targetfile.jpg',
                        mimeType: 'image/jpeg',
                    },
                }, {
                    fileUrl: 'http://localhost/content/dam/target/folder/targetfile2.jpg',
                    fileSize: 1999,
                    blob: '<provided>',
                    result: {
                        fileName: 'targetfile2.jpg',
                        fileSize: 1999,
                        targetFolder: '/content/dam/target/folder',
                        targetFile: '/content/dam/target/folder/targetfile2.jpg',
                        mimeType: 'image/jpeg',
                    },
                }],
                errors: [],
                retryErrors: [],
            })

            // verify that events are correct
            should(events.length).be.exactly(8);
            should(events[0].event).be.exactly('fileuploadstart');
            verifyFile1Event('filestart', events[1]);
            verifyFile1Event('fileprogress', events[2]);
            verifyFile1Event('fileend', events[3]);
            verifyFile2Event('filestart', events[4]);
            verifyFile2Event('fileprogress', events[5]);
            verifyFile2Event('fileend', events[6]);
            should(events[7].event).be.exactly('fileuploadend');
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

            should(events.length).be.exactly(8);

            should(events[0].event).be.exactly('fileuploadstart');
            should(events[0].data.fileCount).be.exactly(2);
            should(events[0].data.totalSize).be.exactly(3023);
            should(events[1].event).be.exactly('filestart');
            should(events[1].data.fileName).be.exactly('targetfile.jpg');
            should(events[2].event).be.exactly('fileprogress');
            should(events[2].data.fileName).be.exactly('targetfile.jpg');
            should(events[2].data.transferred).be.exactly(512);
            should(events[3].event).be.exactly('fileend');
            should(events[3].data.fileName).be.exactly('targetfile.jpg');

            should(events[4].event).be.exactly('filestart');
            should(events[4].data.fileName).be.exactly('targetfile2.jpg');
            should(events[5].event).be.exactly('fileprogress');
            should(events[5].data.fileName).be.exactly('targetfile2.jpg');
            should(events[5].data.transferred).be.exactly(512);
            should(events[6].event).be.exactly('fileend');
            should(events[6].data.fileName).be.exactly('targetfile2.jpg');
            should(events[7].event).be.exactly('fileuploadend');
            should(events[7].data.fileCount).be.exactly(2);
            should(events[7].data.totalSize).be.exactly(3023);
            should(events[7].data.result).be.ok;
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

            await upload.canUpload(options);
        });
    });
});
