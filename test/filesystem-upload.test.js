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

const {
    importFile,
    getTestOptions,
    monitorEvents,
    getEvent,
    getFolderEvent
} = require('./testutils');
const MockRequest = require('./mock-request');
const HttpClient = importFile('http/http-client');
const FileSystemUploadDirectory = importFile('filesystem-upload-directory');
const HttpProxy = importFile('http-proxy');

function MockDirectBinaryUpload() {

}

MockDirectBinaryUpload.prototype.uploadFiles = function (uploadOptions) {
    return new Promise(resolve => {
        resolve(uploadOptions);
    });
}

const FileSystemUploadOptions = importFile('filesystem-upload-options');

const FileSystemUpload = importFile('filesystem-upload');

const SUBDIR = 'sub吏dir';
const SUBDIR_ENCODED = encodeURI(SUBDIR);

const ASSET1 = '吏';
const ASSET1_ENCODED = encodeURI(ASSET1);

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
            const structure = {
                '/test/dir': {
                    '3': '12345678',
                    '4': '1234567',
                },
                '/test/file': {
                    '2': '1234567890'
                }
            };
            structure['/test/dir'][SUBDIR] = {
                'subsubdir': {
                    '7': '123',
                    '8': '12'
                },
                '5': '12345',
                '6': '123456'
            };
            structure['/test/file'][ASSET1] = '123456789';
            MockFs(structure);
        }

        it('filesystem upload smoke test', async () => {
            createFsStructure();

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);

            MockRequest.addDirectUpload('/target');

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth')
                .withUploadFileOptions({
                    createVersion: true,
                    versionLabel: 'test version label',
                    versionComment: 'test version comment',
                    replace: true
                });

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            const result = await fileSystemUpload.upload(uploadOptions, [
                `/test/file/${ASSET1}`,
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

            validateUploadFile(fileLookup[ASSET1], 9);
            validateUploadFile(fileLookup['2'], 10);
            validateUploadFile(fileLookup['3'], 8);
            validateUploadFile(fileLookup['4'], 7);

            const addlOptions = fileLookup['2'].toJSON();
            should(addlOptions.createVersion).be.ok();
            should(addlOptions.versionLabel).be.exactly('test version label');
            should(addlOptions.versionComment).be.exactly('test version comment');
            should(addlOptions.replace).be.ok();
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
                .withBasicAuth('testauth')
                .withHttpProxy(new HttpProxy('http://somereallyfakeproxyhost'));
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
            should(posts[0].proxy).be.ok();
            should(posts[0].proxy.host).be.exactly('somereallyfakeproxyhost');
            should(posts[1].url).be.exactly(MockRequest.getApiUrl('/folder/structure/path1/dir1'))
            should(posts[1].proxy).be.ok();
            should(posts[1].proxy.host).be.exactly('somereallyfakeproxyhost');
            should(posts[2].url).be.exactly(MockRequest.getApiUrl('/folder/structure/path1/dir2'))
            should(posts[2].proxy).be.ok();
            should(posts[2].proxy.host).be.exactly('somereallyfakeproxyhost');
        });

        function buildPostLookup() {
            let postedUrls = {};
            MockRequest.history.post.forEach(post => {
                const { url } = post;

                if (!postedUrls[url]) {
                    postedUrls[url] = 0;
                }
                postedUrls[url]++;
            });
            return postedUrls;
        }

        it('smoke test directory descendent upload', async function () {
            createFsStructure();

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl(`/target/test/dir/${SUBDIR_ENCODED}`)).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl(`/target/test/dir/${SUBDIR_ENCODED}/subsubdir`)).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/file')).reply(201);

            MockRequest.addDirectUpload('/target');
            MockRequest.addDirectUpload('/target/test/dir');
            MockRequest.addDirectUpload(`/target/test/dir/${SUBDIR_ENCODED}`);
            MockRequest.addDirectUpload(`/target/test/dir/${SUBDIR_ENCODED}/subsubdir`);
            MockRequest.addDirectUpload('/target/test/file');

            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth')
                .withHttpRetryCount(1)
                .withHttpRetryDelay(10)
                .withDeepUpload(true);

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            monitorEvents(fileSystemUpload);
            const result = await fileSystemUpload.upload(uploadOptions, [
                '/test',
                `/test/file/${ASSET1}`
            ]);

            should(result).be.ok();
            should(result.getTotalFiles()).be.exactly(9);
            should(result.getTotalCompletedFiles()).be.exactly(result.getTotalFiles());
            should(result.getTotalSize()).be.exactly(59);
            should(result.getErrors().length).be.exactly(0);

            const postedUrls = buildPostLookup();
            should(Object.keys(postedUrls).length).be.exactly(6);
            should(postedUrls[MockRequest.getApiUrl('/target')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/file')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl(`/target/test/dir/${SUBDIR_ENCODED}`)]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl(`/target/test/dir/${SUBDIR_ENCODED}/subsubdir`)]).be.exactly(1);

            const directUploads = MockRequest.getDirectUploads();
            should(directUploads.length).be.exactly(1);

            const uploadFiles = directUploads[0].uploadFiles;
            should(uploadFiles.length).be.exactly(9);
            should(uploadFiles[0].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/3'));
            should(uploadFiles[1].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/4'));
            should(uploadFiles[2].fileUrl).be.exactly(MockRequest.getUrl('/target/test/file/2'));
            should(uploadFiles[3].fileUrl).be.exactly(MockRequest.getUrl('/target/test/file/%E5%90%8F'));
            should(uploadFiles[4].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/sub%E5%90%8Fdir/5'));
            should(uploadFiles[5].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/sub%E5%90%8Fdir/6'));
            should(uploadFiles[6].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/sub%E5%90%8Fdir/subsubdir/7'));
            should(uploadFiles[7].fileUrl).be.exactly(MockRequest.getUrl('/target/test/dir/sub%E5%90%8Fdir/subsubdir/8'));
            should(uploadFiles[8].fileUrl).be.exactly(MockRequest.getUrl('/target/%E5%90%8F'));

            should(getEvent('filestart', `/content/dam/target/${ASSET1}`)).be.ok();
            should(getEvent('fileend', `/content/dam/target/${ASSET1}`)).be.ok();

            should(getEvent('filestart', `/content/dam/target/test/dir/${SUBDIR}/5`)).be.ok();
            should(getEvent('fileend', `/content/dam/target/test/dir/${SUBDIR}/5`)).be.ok();
        });

        it('test upload empty directory', async () => {
            const structure = {
                '/test/dir': {
                    'subdir': {
                        'subsubdir': {}
                    }
                }
            };
            MockFs(structure);
            const uploadOptions = new FileSystemUploadOptions()
                .withUrl(MockRequest.getUrl('/target'))
                .withBasicAuth('testauth')
                .withHttpRetryCount(1)
                .withHttpRetryDelay(10)
                .withDeepUpload(true);

            MockRequest.onPost(MockRequest.getApiUrl('/target')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl('/target/test/dir')).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl(`/target/test/dir/subdir`)).reply(201);
            MockRequest.onPost(MockRequest.getApiUrl(`/target/test/dir/subdir/subsubdir`)).reply(201);

            const fileSystemUpload = new FileSystemUpload(getTestOptions());
            monitorEvents(fileSystemUpload);
            const result = await fileSystemUpload.upload(uploadOptions, [
                '/test'
            ]);
            should(result).be.ok();

            const postedUrls = buildPostLookup();
            should(Object.keys(postedUrls).length).be.exactly(5);
            should(postedUrls[MockRequest.getApiUrl('/target')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir/subdir')]).be.exactly(1);
            should(postedUrls[MockRequest.getApiUrl('/target/test/dir/subdir/subsubdir')]).be.exactly(1);
            should(getFolderEvent('foldercreated', '/content/dam/target')).be.ok();
            should(getFolderEvent('foldercreated', '/content/dam/target/test')).be.ok();
            should(getFolderEvent('foldercreated', '/content/dam/target/test/dir')).be.ok();
            should(getFolderEvent('foldercreated', '/content/dam/target/test/dir/subdir')).be.ok();
            should(getFolderEvent('foldercreated', '/content/dam/target/test/dir/subdir/subsubdir')).be.ok();
        });
    });
});
