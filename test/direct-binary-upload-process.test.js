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
const { Readable } = require('stream');

const { importFile } = require('./testutils');
const MockRequest = require('./mock-request');
const MockBlob = require('./mock-blob');

const DirectBinaryUploadProcess = importFile('direct-binary-upload-process');

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');

describe('DirectBinaryUploadProcessTest', () => {
    beforeEach(() => {
        MockRequest.reset();
    });

    describe('upload', () => {
        async function runCompleteTest(createVersion, versionLabel, versionComment, replace) {
            const targetFolder = `/target/folder-create-version-${new Date().getTime()}`;
            MockRequest.addDirectUpload(targetFolder);
            const fileData = {
                fileName: 'myasset.jpg',
                fileSize: 512,
                blob: new MockBlob(),
            };

            if (createVersion) {
                fileData.createVersion = true;
                if (versionLabel) {
                    fileData.versionLabel = versionLabel;
                }
                if (versionComment) {
                    fileData.versionComment = versionComment;
                }
            }

            if (replace) {
                fileData.replace = true;
            }

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles([fileData]);

            const process = new DirectBinaryUploadProcess({}, options);

            await process.upload();

            // verify that complete request is correct
            const posts = MockRequest.history.post;
            should(posts.length).be.exactly(2);
            should(posts[0].url).be.exactly(MockRequest.getUrl(`${targetFolder}.initiateUpload.json`));
            should(posts[1].url).be.exactly(MockRequest.getUrl(`${targetFolder}.completeUpload.json`));

            const data = querystring.parse(posts[1].data);

            should(data.fileName).be.exactly('myasset.jpg');
            if (createVersion) {
                should(data.createVersion).be.ok();
                if (versionLabel) {
                    should(data.versionLabel).be.exactly(versionLabel);
                } else {
                    should(data.versionLabel).not.be.ok();
                }
                if (versionComment) {
                    should(data.versionComment).be.exactly(versionComment);
                } else {
                    should(versionComment).not.be.ok();
                }
            } else {
                should(data.createVersion).not.be.ok();
                should(data.versionLabel).not.be.ok();
                should(data.versionComment).not.be.ok();
            }
            if (replace && !createVersion) {
                should(data.replace).be.ok();
            } else {
                should(data.replace).not.be.ok();
            }
        }

        it('create version test', async () => {
            await runCompleteTest(true);
        });

        it('create version with label and comments', async () => {
            await runCompleteTest(true, 'label', 'comment');
        });

        it('replace test', async () => {
            await runCompleteTest(false, 'label', 'comment', true);
        });

        it('replace and create version test', async () => {
            await runCompleteTest(true, 'label', 'comment', true);
        });

        function setupRetryTest() {
            const targetFolder = `/target/folder-retry-recovery-${new Date().getTime()}`;
            MockRequest.addDirectUpload(targetFolder);
            const fileData = {
                fileName: 'myasset.jpg',
                fileSize: 512,
                blob: new MockBlob(),
            };

            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles([fileData])
                .withHttpRetryDelay(100);

            return { targetFolder, process: new DirectBinaryUploadProcess({}, options) };
        }

        it('init retry recovery', async () => {
            const { targetFolder, process } = setupRetryTest();

            MockRequest.onInit(targetFolder, async () => {
                MockRequest.removeOnInit(targetFolder);
                return [500];
            });

            const result = await process.upload();
            should(result).be.ok();
            should(result.getTotalCompletedFiles()).be.exactly(1);
            should(result.getErrors().length).be.exactly(0);
            should(result.getRetryErrors().length).be.exactly(1);
        });

        it('part retry recover', async () => {
            const { targetFolder, process } = setupRetryTest();

            MockRequest.onPart(targetFolder, 'myasset.jpg', 0, async () => {
                MockRequest.removeOnPart(targetFolder, 'myasset.jpg', 0);
                return [500];
            });

            const result = await process.upload();
            should(result).be.ok();
            should(result.getTotalCompletedFiles()).be.exactly(1);
            should(result.getErrors().length).be.exactly(0);
            should(result.getRetryErrors().length).be.exactly(0);

            const fileResults = result.getFileUploadResults();
            should(fileResults.length).be.exactly(1);

            const partResults = fileResults[0].getPartUploadResults();
            should(partResults.length).be.exactly(1);
            should(partResults[0].getRetryErrors().length).be.exactly(1);
        });

        it('complete retry recover', async () => {
            const { targetFolder, process } = setupRetryTest();

            MockRequest.onComplete(targetFolder, 'myasset.jpg', async () => {
                MockRequest.removeOnComplete(targetFolder, 'myasset.jpg');
                return [500];
            });

            const result = await process.upload();
            should(result).be.ok();
            should(result.getTotalCompletedFiles()).be.exactly(1);
            should(result.getErrors().length).be.exactly(0);

            const fileResults = result.getFileUploadResults();
            should(fileResults.length).be.exactly(1);
            should(fileResults[0].getRetryErrors().length).be.exactly(1);
        });

        it('file upload smoke', async () => {
            const fileSize = 1024;
            const targetFolder = '/target/file-upload-smoke';
            MockRequest.addDirectUpload(targetFolder);
            const options = new DirectBinaryUploadOptions()
                .withUrl(MockRequest.getUrl(targetFolder))
                .withUploadFiles([{
                    fileName: 'fileuploadsmoke.jpg',
                    fileSize,
                    blob: {
                        slice: () => {
                            const s = new Readable();
                            s._read = () => {};
                            let value = '';
                            for (let i = 0; i < fileSize / 2; i += 1) {
                                value += 'a';
                            }
                            s.push(value);
                            s.push(value);
                            s.push(null);

                            return s;
                        }
                    }
                }]);
            const process = new DirectBinaryUploadProcess({ progressDelay: 0 }, options);

            process.on('fileprogress', event => {
                const { transferred } = event;
                if (transferred !== 512 && transferred !== 1024 && transferred !== 1536 && transferred !== 2048) {
                    should(false).be.ok();
                }
            });

            await process.upload();
        });
    });
});
