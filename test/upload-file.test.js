/*
Copyright 2021 Adobe. All rights reserved.
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

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const UploadFile = importFile('upload-file');

describe('UploadFile Tests', function() {
    function ensureFailure(options, uploadOptions, fileOptions) {
        const uploadFile = new UploadFile(options, uploadOptions, fileOptions);
        try {
            uploadFile.getFileUrl();
        } catch (e) {
            return;
        }
        should(false).be.ok();
    }
    it('test get file URL', async function() {
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://somefakeunittesturl');
        let uploadFile = new UploadFile(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            fileSize: 1024,
            filePath: '/test/file.jpg'
        });
        should(uploadFile.getFileUrl()).be.exactly('http://somefakeunittesturl/testfile.jpg');
        uploadFile = new UploadFile(getTestOptions(), uploadOptions, {
            fileUrl: 'http://fullfileurl/file.jpg',
            fileSize: 0,
            blob: []
        });
        should(uploadFile.getFileUrl()).be.exactly('http://fullfileurl/file.jpg');
        uploadFile = new UploadFile(getTestOptions(), uploadOptions, {
            fileSize: 0,
            blob: []
        });
        ensureFailure(getTestOptions(), uploadOptions, {
            fileSize: 0,
            blob: []
        });
        ensureFailure(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            blob: []
        });
        ensureFailure(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            fileSize: 1024,
        });
        ensureFailure(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            fileSize: 1024,
            blob: {}
        });
    });

    it('test part headers', function() {
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl('http://somefakeunittesturl');
        let uploadFile = new UploadFile(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            fileSize: 1024,
            filePath: '/test/file.jpg'
        });
        should(uploadFile.getPartHeaders()).be.ok();
        should(uploadFile.getPartHeaders().missing).not.be.ok();
        should(uploadFile.toJSON().multipartHeaders).not.be.ok();

        uploadFile = new UploadFile(getTestOptions(), uploadOptions, {
            fileName: 'testfile.jpg',
            fileSize: 1024,
            filePath: '/test/file.jpg',
            partHeaders: {
                hello: 'world!'
            }
        });
        should(uploadFile.getPartHeaders()).be.ok();
        should(uploadFile.getPartHeaders().hello).equal('world!');
        should(uploadFile.toJSON().multipartHeaders.hello).equal('world!');
    });
});
