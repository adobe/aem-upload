/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const should = require('should');

const {
    getTestOptions,
} = require('./testutils');
const FileSystemUploadOptions = require('../src/filesystem-upload-options').default;
const CreateDirectoryResult = require('../src/create-directory-result').default;
const HttpResponse = require('../src/http/http-response').default;

describe('Create Directy Result Tests', () => {
    it('test result with response', function () {
        const response = new HttpResponse(getTestOptions(), {
            status: 201,
            statusText: 'Created',
            elapsedTime: 100,
        });
        const directoryResult = new CreateDirectoryResult(
            getTestOptions(),
            new FileSystemUploadOptions(),
            '/testing',
            'testing',
        );
        directoryResult.setCreateResponse(response);
        should(directoryResult.getFolderPath()).be.exactly('/testing');
        should(directoryResult.getFolderTitle()).be.exactly('testing');
        should(directoryResult.getCreateTime()).be.exactly(100);
        should(directoryResult.getStatus()).be.exactly(201);
        should(directoryResult.toJSON()).deepEqual({
            elapsedTime: 100,
            folderPath: '/testing',
            folderTitle: 'testing',
            retryErrors: [],
            status: 201,
        });
    });

    it('test result without response', function () {
        const directoryResult = new CreateDirectoryResult(
            getTestOptions(),
            new FileSystemUploadOptions(),
            '/testing',
            'testing',
        );
        should(directoryResult.getFolderPath()).be.exactly('/testing');
        should(directoryResult.getFolderTitle()).be.exactly('testing');
        should(directoryResult.getCreateTime()).be.exactly(0);
        should(directoryResult.getStatus()).be.exactly(0);
        should(directoryResult.toJSON()).deepEqual({
            elapsedTime: 0,
            folderPath: '/testing',
            folderTitle: 'testing',
            retryErrors: [],
            status: 0,
        });
    });
});
