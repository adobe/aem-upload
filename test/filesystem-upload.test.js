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

/* eslint-env mocha */

const nock = require('nock');
const should = require('should');
const MockFs = require('mock-fs');

const {
  getTestOptions,
  monitorEvents,
  getEvent,
  getFolderEvent,
  verifyResult,
  resetHttp,
  allHttpUsed,
  getDirectBinaryUploads,
  addDirectUpload,
  addCreateDirectory,
  getFolderCreates,
} = require('./testutils');

const FileSystemUploadDirectory = require('../src/filesystem-upload-directory');
const UploadResult = require('../src/upload-result');

function MockDirectBinaryUpload() {

}

MockDirectBinaryUpload.prototype.uploadFiles = (uploadOptions) => new Promise((resolve) => {
  resolve(uploadOptions);
});

const FileSystemUploadOptions = require('../src/filesystem-upload-options');

const FileSystemUpload = require('../src/filesystem-upload');

const SUBDIR = 'sub吏dir';
const SUBDIR_ENCODED = encodeURI(SUBDIR);

const ASSET1 = '吏';

const HOST = 'http://reallyfakehostforaemuploadtesting';

describe('FileSystemUpload Tests', () => {
  let uploadResult;

  beforeEach(() => {
    resetHttp();

    uploadResult = new UploadResult(getTestOptions(), new FileSystemUploadOptions());
  });

  afterEach(() => {
    should(allHttpUsed()).be.ok();
    resetHttp();
    MockFs.restore();
  });

  describe('upload', () => {
    function createFsStructure() {
      const structure = {
        '/test/dir': {
          3: '12345678',
          4: '1234567',
        },
        '/test/file': {
          2: '1234567890',
        },
      };
      structure['/test/dir'][SUBDIR] = {
        subsubdir: {
          7: '123',
          8: '12',
        },
        5: '12345',
        6: '123456',
      };
      structure['/test/file'][ASSET1] = '123456789';
      MockFs(structure);
    }

    it('filesystem upload smoke test', async () => {
      createFsStructure();

      addCreateDirectory(HOST, '/target');
      addDirectUpload(HOST, '/target', [
        ASSET1,
        '2',
        '3',
        '4',
      ]);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/target`)
        .withUploadFileOptions({
          createVersion: true,
          versionLabel: 'test version label',
          versionComment: 'test version comment',
          replace: true,
        });

      const fileSystemUpload = new FileSystemUpload(getTestOptions());
      const result = await fileSystemUpload.upload(uploadOptions, [
        `/test/file/${ASSET1}`,
        '/test/file/2',
        '/test/dir',
      ]);
      verifyResult(result, {
        host: HOST,
        totalFiles: 4,
        totalTime: result.totalTime,
        totalCompleted: 4,
        totalFileSize: 34,
        folderCreateSpent: result.folderCreateSpent,
        errors: [],
        retryErrors: [],
        createdFolders: [{
          elapsedTime: result.createdFolders[0].elapsedTime,
          folderPath: '/content/dam/target',
          folderTitle: 'target',
          retryErrors: [],
        }],
        detailedResult: [{
          fileUrl: `${HOST}/target/%E5%90%8F`,
          fileSize: 9,
          createVersion: true,
          versionComment: 'test version comment',
          versionLabel: 'test version label',
          replace: true,
          filePath: '/test/file/吏',
          result: {
            fileName: '吏',
            fileSize: 9,
            targetFolder: '/target',
            targetFile: '/target/吏',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/file/吏',
            sourceFolder: '/test/file',
          },
        }, {
          fileUrl: `${HOST}/target/2`,
          fileSize: 10,
          createVersion: true,
          versionComment: 'test version comment',
          versionLabel: 'test version label',
          replace: true,
          filePath: '/test/file/2',
          result: {
            fileName: '2',
            fileSize: 10,
            targetFolder: '/target',
            targetFile: '/target/2',
            sourceFile: '/test/file/2',
            sourceFolder: '/test/file',
            mimeType: 'application/octet-stream',
          },
        }, {
          fileUrl: `${HOST}/target/3`,
          fileSize: 8,
          createVersion: true,
          versionComment: 'test version comment',
          versionLabel: 'test version label',
          replace: true,
          filePath: '/test/dir/3',
          result: {
            fileName: '3',
            fileSize: 8,
            targetFolder: '/target',
            targetFile: '/target/3',
            sourceFile: '/test/dir/3',
            sourceFolder: '/test/dir',
            mimeType: 'application/octet-stream',
          },
        }, {
          fileUrl: `${HOST}/target/4`,
          fileSize: 7,
          createVersion: true,
          versionComment: 'test version comment',
          versionLabel: 'test version label',
          replace: true,
          filePath: '/test/dir/4',
          result: {
            fileName: '4',
            fileSize: 7,
            targetFolder: '/target',
            targetFile: '/target/4',
            sourceFile: '/test/dir/4',
            sourceFolder: '/test/dir',
            mimeType: 'application/octet-stream',
          },
        }],
      });
    });

    it('test directory already exists', async () => {
      addCreateDirectory(HOST, '/existing_target', 409);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/existing_target`)
        .withHttpRetryDelay(10);
      const fsUpload = new FileSystemUpload(getTestOptions());
      return fsUpload.createAemFolder(uploadOptions, uploadResult);
    });

    it('test directory not found', async () => {
      addCreateDirectory(HOST, '/existing_target', 404);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/existing_target`)
        .withHttpRetryDelay(10);
      const fsUpload = new FileSystemUpload(getTestOptions());
      let threw = false;
      try {
        await fsUpload.createAemFolder(uploadOptions, uploadResult);
      } catch (e) {
        threw = true;
      }
      should(threw).be.ok();
    });

    function getFolderRequest(path, title) {
      return {
        body: {
          class: 'assetFolder',
          properties: {
            'jcr:title': title,
          },
        },
        uri: path,
      };
    }

    it('test create target folder', async () => {
      addCreateDirectory(HOST, '/folder', 409);
      addCreateDirectory(HOST, '/folder/structure', 201);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/folder/structure`);
      const fsUpload = new FileSystemUpload(getTestOptions());
      await fsUpload.createTargetFolder(uploadOptions, uploadResult);
      should(getFolderCreates()).deepEqual([
        getFolderRequest('/api/assets/folder', 'folder'),
        getFolderRequest('/api/assets/folder/structure', 'structure'),
      ]);
    });

    it('test create upload directories', async () => {
      addCreateDirectory(HOST, '/folder/structure/path1', 409);
      addCreateDirectory(HOST, '/folder/structure/path1/dir1', 201);
      addCreateDirectory(HOST, '/folder/structure/path1/dir2', 201);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/folder/structure`);
      const path1Dir = new FileSystemUploadDirectory(uploadOptions, '/prefix/path1', 'path1');
      const fsUpload = new FileSystemUpload(getTestOptions());
      await fsUpload.createUploadDirectories(uploadOptions, uploadResult, [
        path1Dir,
        new FileSystemUploadDirectory(uploadOptions, '/prefix/path1/dir1/', 'dir1', path1Dir),
        new FileSystemUploadDirectory(uploadOptions, '/prefix/path1/dir2', 'dir2', path1Dir),
      ]);

      should(getFolderCreates()).deepEqual([
        getFolderRequest('/api/assets/folder/structure/path1', 'path1'),
        getFolderRequest('/api/assets/folder/structure/path1/dir1', 'dir1'),
        getFolderRequest('/api/assets/folder/structure/path1/dir2', 'dir2'),
      ]);
    });

    it('smoke test directory descendent upload', async () => {
      createFsStructure();

      addCreateDirectory(HOST, '/target');
      addCreateDirectory(HOST, '/target/test');
      addCreateDirectory(HOST, '/target/test/dir');
      addCreateDirectory(HOST, `/target/test/dir/${SUBDIR_ENCODED}`);
      addCreateDirectory(HOST, `/target/test/dir/${SUBDIR_ENCODED}/subsubdir`);
      addCreateDirectory(HOST, '/target/test/file');

      addDirectUpload(HOST, '/target/test/dir', [
        '3',
        '4',
      ]);

      addDirectUpload(HOST, '/target', [
        '吏',
      ]);

      addDirectUpload(HOST, '/target/test/file', [
        '2',
        '吏',
      ]);

      addDirectUpload(HOST, '/target/test/dir/sub吏dir', [
        '5',
        '6',
      ]);

      addDirectUpload(HOST, '/target/test/dir/sub吏dir/subsubdir', [
        '7',
        '8',
      ]);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/target`)
        .withHttpRetryCount(1)
        .withHttpRetryDelay(10)
        .withDeepUpload(true);

      const fileSystemUpload = new FileSystemUpload(getTestOptions());
      monitorEvents(fileSystemUpload);
      const result = await fileSystemUpload.upload(uploadOptions, [
        '/test',
        `/test/file/${ASSET1}`,
      ]);

      verifyResult(result, {
        host: HOST,
        totalFiles: 9,
        totalCompleted: 9,
        totalTime: result.totalTime,
        totalFileSize: 59,
        folderCreateSpent: result.folderCreateSpent,
        retryErrors: [],
        errors: [],
        createdFolders: [{
          elapsedTime: result.createdFolders[0].elapsedTime,
          folderPath: '/content/dam/target',
          folderTitle: 'target',
          retryErrors: [],
        }, {
          elapsedTime: result.createdFolders[1].elapsedTime,
          folderPath: '/target/test',
          folderTitle: 'test',
          retryErrors: [],
        }, {
          elapsedTime: result.createdFolders[2].elapsedTime,
          folderPath: '/target/test/dir',
          folderTitle: 'dir',
          retryErrors: [],
        }, {
          elapsedTime: result.createdFolders[3].elapsedTime,
          folderPath: '/target/test/file',
          folderTitle: 'file',
          retryErrors: [],
        }, {
          elapsedTime: result.createdFolders[4].elapsedTime,
          folderPath: '/target/test/dir/sub吏dir',
          folderTitle: 'sub吏dir',
          retryErrors: [],
        }, {
          elapsedTime: result.createdFolders[5].elapsedTime,
          folderPath: '/target/test/dir/sub吏dir/subsubdir',
          folderTitle: 'subsubdir',
          retryErrors: [],
        }],
        detailedResult: [{
          fileUrl: `${HOST}/target/test/dir/3`,
          fileSize: 8,
          filePath: '/test/dir/3',
          result: {
            fileName: '3',
            fileSize: 8,
            targetFolder: '/target/test/dir',
            targetFile: '/target/test/dir/3',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/3',
            sourceFolder: '/test/dir',
          },
        }, {
          fileUrl: `${HOST}/target/test/dir/4`,
          fileSize: 7,
          filePath: '/test/dir/4',
          result: {
            fileName: '4',
            fileSize: 7,
            targetFolder: '/target/test/dir',
            targetFile: '/target/test/dir/4',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/4',
            sourceFolder: '/test/dir',
          },
        }, {
          fileUrl: `${HOST}/target/test/file/2`,
          fileSize: 10,
          filePath: '/test/file/2',
          result: {
            fileName: '2',
            fileSize: 10,
            targetFolder: '/target/test/file',
            targetFile: '/target/test/file/2',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/file/2',
            sourceFolder: '/test/file',
          },
        }, {
          fileUrl: `${HOST}/target/test/file/%E5%90%8F`,
          fileSize: 9,
          filePath: '/test/file/吏',
          result: {
            fileName: '吏',
            fileSize: 9,
            targetFolder: '/target/test/file',
            targetFile: '/target/test/file/吏',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/file/吏',
            sourceFolder: '/test/file',
          },
        }, {
          fileUrl: `${HOST}/target/test/dir/sub%E5%90%8Fdir/5`,
          fileSize: 5,
          filePath: '/test/dir/sub吏dir/5',
          result: {
            fileName: '5',
            fileSize: 5,
            targetFolder: '/target/test/dir/sub吏dir',
            targetFile: '/target/test/dir/sub吏dir/5',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/sub吏dir/5',
            sourceFolder: '/test/dir/sub吏dir',
          },
        }, {
          fileUrl: `${HOST}/target/test/dir/sub%E5%90%8Fdir/6`,
          fileSize: 6,
          filePath: '/test/dir/sub吏dir/6',
          result: {
            fileName: '6',
            fileSize: 6,
            targetFolder: '/target/test/dir/sub吏dir',
            targetFile: '/target/test/dir/sub吏dir/6',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/sub吏dir/6',
            sourceFolder: '/test/dir/sub吏dir',
          },
        }, {
          fileUrl: `${HOST}/target/test/dir/sub%E5%90%8Fdir/subsubdir/7`,
          fileSize: 3,
          filePath: '/test/dir/sub吏dir/subsubdir/7',
          result: {
            fileName: '7',
            fileSize: 3,
            targetFolder: '/target/test/dir/sub吏dir/subsubdir',
            targetFile: '/target/test/dir/sub吏dir/subsubdir/7',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/sub吏dir/subsubdir/7',
            sourceFolder: '/test/dir/sub吏dir/subsubdir',
          },
        }, {
          fileUrl: `${HOST}/target/test/dir/sub%E5%90%8Fdir/subsubdir/8`,
          fileSize: 2,
          filePath: '/test/dir/sub吏dir/subsubdir/8',
          result: {
            fileName: '8',
            fileSize: 2,
            targetFolder: '/target/test/dir/sub吏dir/subsubdir',
            targetFile: '/target/test/dir/sub吏dir/subsubdir/8',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/dir/sub吏dir/subsubdir/8',
            sourceFolder: '/test/dir/sub吏dir/subsubdir',
          },
        }, {
          fileUrl: `${HOST}/target/%E5%90%8F`,
          fileSize: 9,
          filePath: '/test/file/吏',
          result: {
            fileName: '吏',
            fileSize: 9,
            targetFolder: '/target',
            targetFile: '/target/吏',
            mimeType: 'application/octet-stream',
            sourceFile: '/test/file/吏',
            sourceFolder: '/test/file',
          },
        }],
      });

      should(getFolderCreates()).deepEqual([
        getFolderRequest('/api/assets/target', 'target'),
        getFolderRequest('/api/assets/target/test', 'test'),
        getFolderRequest('/api/assets/target/test/dir', 'dir'),
        getFolderRequest('/api/assets/target/test/file', 'file'),
        getFolderRequest(`/api/assets/target/test/dir/${SUBDIR_ENCODED}`, 'sub吏dir'),
        getFolderRequest(`/api/assets/target/test/dir/${SUBDIR_ENCODED}/subsubdir`, 'subsubdir'),
      ]);

      const {
        inits = [],
        parts = [],
        completes = [],
      } = getDirectBinaryUploads();
      should(inits.length >= 5).be.ok();
      should(parts.length).be.exactly(9);
      should(completes.length).be.exactly(9);
      should(parts[0].uri).be.exactly('/target/test/dir/3');
      should(parts[1].uri).be.exactly('/target/test/dir/4');
      should(parts[2].uri).be.exactly('/target/test/file/2');
      should(parts[3].uri).be.exactly('/target/test/file/%E5%90%8F');
      should(parts[4].uri).be.exactly('/target/test/dir/sub%E5%90%8Fdir/5');
      should(parts[5].uri).be.exactly('/target/test/dir/sub%E5%90%8Fdir/6');
      should(parts[6].uri).be.exactly('/target/test/dir/sub%E5%90%8Fdir/subsubdir/7');
      should(parts[7].uri).be.exactly('/target/test/dir/sub%E5%90%8Fdir/subsubdir/8');
      should(parts[8].uri).be.exactly('/target/%E5%90%8F');

      should(getEvent('filestart', `/target/${ASSET1}`)).be.ok();
      should(getEvent('fileend', `/target/${ASSET1}`)).be.ok();

      should(getEvent('filestart', `/target/test/dir/${SUBDIR}/5`)).be.ok();
      should(getEvent('fileend', `/target/test/dir/${SUBDIR}/5`)).be.ok();
    });

    it('test upload empty directory', async () => {
      const structure = {
        '/test/dir': {
          subdir: {
            subsubdir: {},
          },
        },
      };
      MockFs(structure);
      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/target`)
        .withHttpRetryCount(1)
        .withHttpRetryDelay(10)
        .withDeepUpload(true);

      addCreateDirectory(HOST, '/target');
      addCreateDirectory(HOST, '/target/test');
      addCreateDirectory(HOST, '/target/test/dir');
      addCreateDirectory(HOST, '/target/test/dir/subdir');
      addCreateDirectory(HOST, '/target/test/dir/subdir/subsubdir');

      const fileSystemUpload = new FileSystemUpload(getTestOptions());
      monitorEvents(fileSystemUpload);
      const result = await fileSystemUpload.upload(uploadOptions, [
        '/test',
      ]);
      should(result).be.ok();

      should(getFolderCreates()).deepEqual([
        getFolderRequest('/api/assets/target', 'target'),
        getFolderRequest('/api/assets/target/test', 'test'),
        getFolderRequest('/api/assets/target/test/dir', 'dir'),
        getFolderRequest('/api/assets/target/test/dir/subdir', 'subdir'),
        getFolderRequest('/api/assets/target/test/dir/subdir/subsubdir', 'subsubdir'),
      ]);

      should(getFolderEvent('foldercreated', '/content/dam/target')).be.ok();
      should(getFolderEvent('foldercreated', '/target/test')).be.ok();
      should(getFolderEvent('foldercreated', '/target/test/dir')).be.ok();
      should(getFolderEvent('foldercreated', '/target/test/dir/subdir')).be.ok();
      should(getFolderEvent('foldercreated', '/target/test/dir/subdir/subsubdir')).be.ok();
    });

    it('test eventually consistent upload', async () => {
      const structure = {
        '/test': {
          'consistency1.jpg': '12345',
        },
        '/test/subdir': {
          'consistency2.jpg': '78910',
        },
      };
      MockFs(structure);

      const uploadOptions = new FileSystemUploadOptions()
        .withUrl(`${HOST}/target`)
        .withHttpRetryDelay(10)
        .withDeepUpload(true)
        .withHttpOptions({
          cloudClient: {
            eventuallyConsistentCreate: true,
          },
        });

      addCreateDirectory(HOST, '/target');
      // tests that retry on directory creation works correctly
      addCreateDirectory(HOST, '/target/test', 404);
      addCreateDirectory(HOST, '/target/test');
      addCreateDirectory(HOST, '/target/test/subdir');

      addDirectUpload(HOST, '/target/test', [
        'consistency1.jpg',
      ]);
      // tests that retry on initiate works correctly
      nock(HOST)
        .post('/target/test/subdir.initiateUpload.json')
        .reply(404);
      // tests that retry on complete works correctly
      nock(HOST)
        .post('/target/test/subdir.completeUpload.json')
        .reply(404);
      addDirectUpload(HOST, '/target/test/subdir', [
        'consistency2.jpg',
      ]);

      const fileSystemUpload = new FileSystemUpload(getTestOptions());
      monitorEvents(fileSystemUpload);
      const result = await fileSystemUpload.upload(uploadOptions, ['/test']);
      should(result).be.ok();
      should(result.totalFiles).equal(2);
      should(result.totalFileSize).equal(10);
    });
  });
});
