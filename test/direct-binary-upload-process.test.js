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

const should = require('should');
const { Readable } = require('stream');

const {
  getTestOptions,
  addDirectUpload,
  resetHttp,
  allHttpUsed,
  getDirectBinaryUploads,
  parseQuery,
} = require('./testutils');
const MockBlob = require('./mock-blob');
const UploadResult = require('../src/upload-result');
const DirectBinaryUploadProcess = require('../src/direct-binary-upload-process');
const DirectBinaryUploadOptions = require('../src/direct-binary-upload-options');

const HOST = 'http://reallyfakeaemuploadhost';

describe('DirectBinaryUploadProcessTest', () => {
  beforeEach(() => {
    resetHttp();
  });

  afterEach(() => {
    should(allHttpUsed()).be.ok();
    resetHttp();
  });

  describe('upload', () => {
    async function runCompleteTest(createVersion, versionLabel, versionComment, replace) {
      const targetFolder = `/content/dam/target/folder-create-version-${new Date().getTime()}`;
      addDirectUpload(HOST, targetFolder, ['myasset.jpg']);
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
        .withUrl(`${HOST}${targetFolder}`)
        .withUploadFiles([fileData]);

      const process = new DirectBinaryUploadProcess(getTestOptions(), options);

      await process.upload(new UploadResult(getTestOptions(), options));

      // verify that complete request is correct
      const {
        inits = [],
        parts = [],
        completes = [],
      } = getDirectBinaryUploads();
      should(inits.length).be.ok();
      const init = inits[inits.length - 1];
      should(init.uri).equal(`${targetFolder}.initiateUpload.json`);
      should(parseQuery(init.body)).deepEqual({
        fileName: 'myasset.jpg',
        fileSize: '512',
      });
      should(parts).deepEqual([{
        uri: `${targetFolder}/myasset.jpg`,
        body: '0,512,',
      }]);
      should(completes.length).equal(1);
      should(completes[0].uri).equal(`${targetFolder}.completeUpload.json`);

      const completeInfo = parseQuery(completes[0].body);
      should(completeInfo.fileName).equal('myasset.jpg');
      should(completeInfo.fileSize).equal('512');
      should(completeInfo.mimeType).equal('image/jpeg');
      should(completeInfo.uploadToken).be.ok();
      should(completeInfo.uploadDuration).be.ok();

      if (createVersion) {
        should(completeInfo.createVersion).be.ok();
        if (versionLabel) {
          should(completeInfo.versionLabel).be.exactly(versionLabel);
        } else {
          should(completeInfo.versionLabel).not.be.ok();
        }
        if (versionComment) {
          should(completeInfo.versionComment).be.exactly(versionComment);
        } else {
          should(versionComment).not.be.ok();
        }
      } else {
        const { createVersion: completeCreateVersion = 'false' } = completeInfo;
        should(completeCreateVersion).equal('false');
        should(completeInfo.versionLabel).not.be.ok();
        should(completeInfo.versionComment).not.be.ok();
      }

      const { replace: completeReplace = 'false' } = completeInfo;
      if (replace) {
        should(completeReplace).equal('true');
      } else {
        should(completeReplace).equal('false');
      }
    }

    it('create version only test', async () => {
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

    it('trailing slash', async () => {
      const targetFolder = '/target/folder-trailing-slash';
      addDirectUpload(HOST, targetFolder, ['myasset.jpg']);

      const options = new DirectBinaryUploadOptions()
        .withUrl(`${HOST}${targetFolder}/`)
        .withUploadFiles([{
          fileName: 'myasset.jpg',
          fileSize: 512,
          blob: new MockBlob(),
        }]);
      const process = new DirectBinaryUploadProcess(getTestOptions(), options);
      await process.upload(new UploadResult(getTestOptions(), options));

      const { parts = [] } = getDirectBinaryUploads();
      should(parts).deepEqual([{
        uri: `${targetFolder}/myasset.jpg`,
        body: '0,512,',
      }]);
    });

    it('file upload smoke', async () => {
      const fileSize = 1024;
      const targetFolder = '/target/file-upload-smoke';
      addDirectUpload(HOST, targetFolder, ['fileuploadsmoke.jpg']);
      const options = new DirectBinaryUploadOptions()
        .withUrl(`${HOST}${targetFolder}`)
        .withUploadFiles([{
          fileName: 'fileuploadsmoke.jpg',
          fileSize,
          blob: {
            slice: () => {
              const s = new Readable();
              // eslint-disable-next-line no-underscore-dangle
              s._read = () => {};
              let value = '';
              for (let i = 0; i < fileSize / 2; i += 1) {
                value += 'a';
              }
              s.push(value);
              s.push(value);
              s.push(null);

              return s;
            },
          },
        }]);
      const process = new DirectBinaryUploadProcess({
        ...getTestOptions(),
        progressDelay: 0,
      }, options);

      await process.upload(new UploadResult(getTestOptions(), options));

      const {
        inits = [],
        parts = [],
        completes = [],
      } = getDirectBinaryUploads();
      should(inits.length > 0).be.ok();
      should(inits[inits.length - 1].uri).equal(`${targetFolder}.initiateUpload.json`);

      should(parts.length).equal(1);
      should(parts[0].uri).equal(`${targetFolder}/fileuploadsmoke.jpg`);
      should(parts[0].body.length).equal(1024);

      should(completes.length).equal(1);
      should(completes[0].uri).equal(`${targetFolder}.completeUpload.json`);
      should(completes[0].body).be.ok();
    });

    it('test total upload size', () => {
      const options = new DirectBinaryUploadOptions()
        .withUploadFiles([{
          fileName: 'fileuploadsmoke.jpg',
          fileSize: 1024,
          filePath: '/test/file/path.jpg',
        }, {
          fileName: 'fileuploadsmoke2.jpg',
          fileSize: 2048,
          filePath: '/test/file/path2.jpg',
        }]);
      const process = new DirectBinaryUploadProcess(getTestOptions(), options);
      should(process.getTotalSize()).be.exactly(3072);
    });
  });
});
