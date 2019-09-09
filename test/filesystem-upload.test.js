/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

const should = require('should');

const { importFile } = require('./testutils');
const MockRequest = require('./mock-request');

function MockDirectBinaryUpload() {

}

MockDirectBinaryUpload.prototype.uploadFiles = function (uploadOptions) {
    return new Promise(resolve => {
        resolve(uploadOptions);
    });
}

let paths = {};
const FileSystemUpload = importFile('filesystem-upload', {
    './direct-binary-upload': MockDirectBinaryUpload,
    'fs': {
        stat: function (path, callback) {
            if (!paths[path]) {
                callback(`path '${path}' not found`);
                return;
            }
            callback(null, paths[path]);
        }, readdir: function (path, callback) {
            if (!paths[path]) {
                callback(`path '${path}' not found`);
                return;
            }

            const { children } = paths[path];

            if (!children) {
                callback(`path '${path}' is not a directory`);
                return;
            }

            callback(null, children);
        }
    },
});

function addTestPath(path, size, children) {
    paths[path] = {
        size,
        isFile: function () {
            return !children;
        },
        isDirectory: function () {
            return !!children;
        }
    };

    if (children) {
        paths[path].children = children;
    }
}

describe('FileSystemUpload Tests', () => {
    beforeEach(() => {
        paths = {};
    });

    describe('upload', () => {
        function validateUploadFile(uploadFile, filePath, fileSize) {
            should(uploadFile).be.ok();
            should(uploadFile.filePath).be.exactly(filePath);
            should(uploadFile.fileSize).be.exactly(fileSize);
        }

        it('smoke test', async () => {
            addTestPath('/test/file/1', 512);
            addTestPath('/test/file/2', 1024);
            addTestPath('/test/dir/3', 2048);
            addTestPath('/test/dir/4', 2000);
            addTestPath('/test/dir', 0, ['3', '4']);

            MockRequest.onPost(MockRequest.getUrl('/target')).reply([201]);

            const fileSystemUpload = new FileSystemUpload();
            const result = await fileSystemUpload.upload({
                host: MockRequest.getHost(),
                auth: 'testauth',
                targetFolder: '/content/dam/target',
                fromArr: [
                    '/test/file/1',
                    '/test/file/2',
                    '/test/dir',
                ],
            });

            should(result).be.ok();
            should(result.getUrl()).be.exactly(MockRequest.getUrl('/target'));

            const uploadFiles = result.getUploadFiles();
            should(uploadFiles.length).be.exactly(4);

            const fileLookup = {};
            uploadFiles.forEach(uploadFile => {
                fileLookup[uploadFile.fileName] = uploadFile;
            });

            validateUploadFile(fileLookup['1'], '/test/file/1', 512);
            validateUploadFile(fileLookup['2'], '/test/file/2', 1024);
            validateUploadFile(fileLookup['3'], '/test/dir/3', 2048);
            validateUploadFile(fileLookup['4'], '/test/dir/4', 2000);
        });
    });
});
