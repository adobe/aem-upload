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
const MockFs = require('mock-fs');

const { importFile, getTestOptions } = require('./testutils');
const MockRequest = require('./mock-request');
const HttpClient = importFile('http/http-client');
const FileSystemUploadDirectory = importFile('filesystem-upload-directory');

function MockDirectBinaryUpload() {

}

MockDirectBinaryUpload.prototype.uploadFiles = function (uploadOptions) {
    return new Promise(resolve => {
        resolve(uploadOptions);
    });
}

const FileSystemUploadOptions = importFile('filesystem-upload-options');

const FileSystemUpload = importFile('filesystem-upload');

describe('FileSystemUpload Tests', () => {
    let httpClient;
    beforeEach(() => {
        MockRequest.reset();

        httpClient = new HttpClient(getTestOptions(), new FileSystemUploadOptions());
    });

    afterEach(() => {
        MockFs.restore();
    });

    describe('upload', () => {
        function validateUploadFile(uploadFile, fileSize) {
            should(uploadFile).be.ok();
            should(uploadFile.getFileSize()).be.exactly(fileSize);
        }

        function createFsStructure() {
            MockFs({
                '/test/dir': {
                    '3': '12345678',
                    '4': '1234567',
                    'subdir': {
                        'subsubdir': {
                            '7': '123',
                            '8': '12'
                        },
                        '5': '12345',
                        '6': '123456'
                    }
                },
                '/test/file': {
                    '1': '123456789',
                    '2': '1234567890'
                }
            });
        }

        it('filesystem upload smoke test', async () => {
            createFsStructure();

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);

            MockRequest.addDirectUpload('/target');

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth');

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            const result = await fileSystemUpload.upload(uploadOptions, [
                '/test/file/1',
                '/test/file/2',
                '/test/dir',
            ]);

            should(result).be.ok();
            should(result.getErrors().length).be.exactly(0);

            const uploadFiles = result.getFileUploadResults();
            should(uploadFiles.length).be.exactly(4);

            const fileLookup = {};
            uploadFiles.forEach(uploadFile => {
                fileLookup[uploadFile.getFileName()] = uploadFile;
            });

            validateUploadFile(fileLookup['1'], 9);
            validateUploadFile(fileLookup['2'], 10);
            validateUploadFile(fileLookup['3'], 8);
            validateUploadFile(fileLookup['4'], 7);
        });

        it('test directory already exists', async () => {
            MockRequest.onPost(MockRequest.getApiUrl('/existing_target')).reply(409);

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/existing_target'))
                .withHttpRetryDelay(10)
                .withBasicAuth('testauth');
            const fsUpload = new FileSystemUpload(getTestOptions());
            return fsUpload.createAemFolder(uploadOptions, httpClient);
        });

        it('test directory not found', async () => {
            MockRequest.onPost(MockRequest.getApiUrl('/existing_target')).reply(404);

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/existing_target'))
                .withHttpRetryDelay(10)
                .withBasicAuth('testauth');
            const fsUpload = new FileSystemUpload(getTestOptions());
            let threw = false;
            try {
                await fsUpload.createAemFolder(uploadOptions, httpClient);
            } catch (e) {
                threw = true;
            }
            should(threw).be.ok();
        });

        it('test create target folder', async () => {
            MockRequest.onPost(MockRequest.getApiUrl('/folder')).reply(409);
            MockRequest.onPost(MockRequest.getApiUrl('/folder/structure')).reply(201);

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/folder/structure'))
                .withBasicAuth('testauth');
            const fsUpload = new FileSystemUpload(getTestOptions());
            await fsUpload.createTargetFolder(uploadOptions, httpClient);
            const { post: posts = [] } = MockRequest.history;
            should(posts.length).be.exactly(2);
            should(posts[0].url).be.exactly(MockRequest.getApiUrl('/folder'));
            should(posts[1].url).be.exactly(MockRequest.getApiUrl('/folder/structure'));
        });

        it('test create upload directories', async () => {
            MockRequest.onPost(MockRequest.getApiUrl('/folder/structure/path1')).reply(409);
            MockRequest.onPost(MockRequest.getApiUrl('/folder/structure/path1/dir1')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/folder/structure/path1/dir2')).reply(201);

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/folder/structure'))
                .withBasicAuth('testauth');
            const path1Dir = new FileSystemUploadDirectory(uploadOptions, '/prefix/path1', 'path1');
            const fsUpload = new FileSystemUpload(getTestOptions());
            await fsUpload.createUploadDirectories(uploadOptions, httpClient, [
                    path1Dir,
                    new FileSystemUploadDirectory(uploadOptions, '/prefix/path1/dir1/', 'dir1', path1Dir),
                    new FileSystemUploadDirectory(uploadOptions, '/prefix/path1/dir2', 'dir2', path1Dir),
                ],
            );

            const { post: posts = [] } = MockRequest.history;
            should(posts.length).be.exactly(3);
            should(posts[0].url).be.exactly(MockRequest.getApiUrl('/folder/structure/path1'))
            should(posts[1].url).be.exactly(MockRequest.getApiUrl('/folder/structure/path1/dir1'))
            should(posts[2].url).be.exactly(MockRequest.getApiUrl('/folder/structure/path1/dir2'))
        });

        it('smoke test directory descendent upload', async function () {
            createFsStructure();

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir/subdir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir/subdir/subsubdir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/file')).reply(201);

            MockRequest.addDirectUpload('/target');
            MockRequest.addDirectUpload('/target/test/dir');
            MockRequest.addDirectUpload('/target/test/dir/subdir');
            MockRequest.addDirectUpload('/target/test/dir/subdir/subsubdir');
            MockRequest.addDirectUpload('/target/test/file');

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth')
                .withHttpRetryCount(1)
                .withHttpRetryDelay(10)
                .withDeepUpload(true);

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            const result = await fileSystemUpload.upload(uploadOptions, [
                '/test',
                '/test/file/1'
            ]);

            // console.log(JSON.stringify(result.toJSON(), null, 2));
            should(result).be.ok();
            should(result.getTotalFiles()).be.exactly(9);
            should(result.getTotalCompletedFiles()).be.exactly(result.getTotalFiles());
            should(result.getTotalSize()).be.exactly(59);
            should(result.getErrors().length).be.exactly(0);

            let postedUrls = {};
            MockRequest.history.post.forEach(post => {
                const { url } = post;

                if (!postedUrls[url]) {
                    postedUrls[url] = 0;
                }
                postedUrls[url]++;
            });

            should(Object.keys(postedUrls).length).be.exactly(16);
            should(postedUrls[MockRequest.getApiUrl('/target')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/file')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir/subdir')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir/subdir/subsubdir')]).be.exactly(1);

            should(postedUrls[MockRequest.getUrl('/target.initiateUpload.json')]).be.exactly(1);
            should(postedUrls[MockRequest.getUrl('/target/test/dir.initiateUpload.json')]).be.exactly(1);
            should(postedUrls[MockRequest.getUrl('/target/test/file.initiateUpload.json')]).be.exactly(1);
            should(postedUrls[MockRequest.getUrl('/target/test/dir/subdir.initiateUpload.json')]).be.exactly(1);
            should(postedUrls[MockRequest.getUrl('/target/test/dir/subdir/subsubdir.initiateUpload.json')]).be.exactly(1);

            should(postedUrls[MockRequest.getUrl('/target.completeUpload.json')]).be.exactly(1);
            should(postedUrls[MockRequest.getUrl('/target/test/dir.completeUpload.json')]).be.exactly(2);
            should(postedUrls[MockRequest.getUrl('/target/test/file.completeUpload.json')]).be.exactly(2);
            should(postedUrls[MockRequest.getUrl('/target/test/dir/subdir.completeUpload.json')]).be.exactly(2);
            should(postedUrls[MockRequest.getUrl('/target/test/dir/subdir/subsubdir.completeUpload.json')]).be.exactly(2);
        });

        it('test directory descendent upload error', async function() {
            createFsStructure();

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir/subdir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir/subdir/subsubdir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/file')).reply(201);

            MockRequest.addDirectUpload('/target/test/dir');

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth')
                .withHttpRetryCount(1)
                .withHttpRetryDelay(10)
                .withDeepUpload(true);

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            const result = await fileSystemUpload.upload(uploadOptions, [
                '/test'
            ]);

            should(result).be.ok();
            should(result.getTotalFiles()).be.exactly(2);
            should(result.getTotalCompletedFiles()).be.exactly(result.getTotalFiles());
            should(result.getTotalSize()).be.exactly(15);
            should(result.getErrors().length).be.exactly(3);
        });
    });
});
