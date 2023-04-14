/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* eslint-env mocha */

const should = require('should');

const FileSystemUploadDirectory = require('../src/filesystem-upload-directory');
const DirectBinaryUploadOptions = require('../src/direct-binary-upload-options');

describe('FileSystemUploadDirectory Tests', () => {
  it('test get remote path', () => {
    const options = new DirectBinaryUploadOptions()
      .withUrl('http://somereallyfakeunittesturl/content/dam/test%20path');
    const directory = new FileSystemUploadDirectory(options, '/local/directory', 'remote-name');
    should(directory.getRemotePath()).be.exactly('/content/dam/test path/remote-name');

    const child = new FileSystemUploadDirectory(options, '/local/directory/child', 'child-name', directory);
    should(child.getRemotePath()).be.exactly('/content/dam/test path/remote-name/child-name');
  });
});
