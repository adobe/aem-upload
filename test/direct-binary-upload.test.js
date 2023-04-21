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

const {
  getTestOptions,
  verifyResult,
  addDirectUpload,
  getDirectBinaryUploads,
  allHttpUsed,
  resetHttp,
  parseQuery,
} = require('./testutils');
const MockBlob = require('./mock-blob');

const DirectBinaryUpload = require('../src/direct-binary-upload');
const DirectBinaryUploadOptions = require('../src/direct-binary-upload-options');

let blob1; let blob2; let
  events;
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
  should(event.targetFolder).be.exactly(`/target/${folderName}`);
  should(event.targetFile).be.exactly(`/target/${folderName}/targetfile.jpg`);

  if (eventName !== 'filestart') {
    should(event.mimeType).be.exactly('image/jpeg');
  }
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
  should(event.targetFolder).be.exactly(`/target/${folderName}`);
  should(event.targetFile).be.exactly(`/target/${folderName}/targetfile2.jpg`);

  if (eventName !== 'filestart') {
    should(event.mimeType).be.exactly('image/jpeg');
  }
  if (eventName === 'fileprogress') {
    should(event.transferred).be.greaterThan(0);
  }
  if (eventName === 'fileerror') {
    should(event.errors.length).be.greaterThan(0);
  }
}

function monitorEvents(upload) {
  upload.on('fileuploadstart', (data) => {
    events.push({ event: 'fileuploadstart', data });
  });
  upload.on('fileuploadend', (data) => {
    events.push({ event: 'fileuploadend', data });
  });
  upload.on('filestart', (data) => {
    events.push({ event: 'filestart', data });
  });
  upload.on('fileend', (data) => {
    events.push({ event: 'fileend', data });
  });
  upload.on('fileprogress', (data) => {
    events.push({ event: 'fileprogress', data });
  });
  upload.on('fileerror', (data) => {
    events.push({ event: 'fileerror', data });
  });
  upload.on('filecancelled', (data) => {
    events.push({ event: 'filecancelled', data });
  });
}

const HOST = 'http://reallyfakehostforaemupload';

describe('DirectBinaryUploadTest', () => {
  beforeEach(() => {
    resetHttp();
    events = [];
  });

  afterEach(() => {
    should(allHttpUsed()).be.ok();
    resetHttp();
  });

  describe('uploadFiles', () => {
    it('direct upload smoke test', async () => {
      addDirectUpload(HOST, '/target/folder', getTestUploadFiles().map((file) => file.fileName));
      const options = new DirectBinaryUploadOptions()
        .withUrl(`${HOST}/target/folder`)
        .withUploadFiles(getTestUploadFiles())
        .withConcurrent(false);

      const upload = new DirectBinaryUpload(getTestOptions());
      monitorEvents(upload);

      const result = await upload.uploadFiles(options);
      should(result).be.ok();

      const {
        inits = [],
        parts = [],
        completes = [],
      } = getDirectBinaryUploads();
      should(inits.length > 0).be.ok();
      should(inits[inits.length - 1].uri).equal('/target/folder.initiateUpload.json');

      should(parts).deepEqual([{
        uri: '/target/folder/targetfile.jpg',
        body: '0,1024,',
      }, {
        uri: '/target/folder/targetfile2.jpg',
        body: '0,1999,',
      }]);

      should(completes.length).equal(2);
      should(completes[0].uri).equal('/target/folder.completeUpload.json');
      should(completes[1].uri).equal('/target/folder.completeUpload.json');

      const complete1 = parseQuery(completes[0].body);
      const complete2 = parseQuery(completes[1].body);
      should(complete1).deepEqual({
        createVersion: 'false',
        fileName: 'targetfile.jpg',
        fileSize: '1024',
        mimeType: 'image/jpeg',
        replace: 'false',
        uploadDuration: complete1.uploadDuration,
        uploadToken: complete1.uploadToken,
      });
      should(complete2).deepEqual({
        createVersion: 'false',
        fileName: 'targetfile2.jpg',
        fileSize: '1999',
        mimeType: 'image/jpeg',
        replace: 'false',
        uploadDuration: complete2.uploadDuration,
        uploadToken: complete2.uploadToken,
      });
      should(complete1.uploadDuration).be.ok();
      should(complete1.uploadToken).be.ok();
      should(complete2.uploadDuration).be.ok();
      should(complete2.uploadToken).be.ok();

      // verify return value
      verifyResult(result, {
        host: HOST,
        totalFiles: 2,
        totalTime: result.totalTime,
        totalCompleted: 2,
        totalFileSize: 3023,
        folderCreateSpent: 0,
        createdFolders: [],
        detailedResult: [{
          fileUrl: `${HOST}/target/folder/targetfile.jpg`,
          fileSize: 1024,
          blob: '<provided>',
          result: {
            fileName: 'targetfile.jpg',
            fileSize: 1024,
            targetFolder: '/target/folder',
            targetFile: '/target/folder/targetfile.jpg',
            mimeType: 'image/jpeg',
            sourceFile: '',
            sourceFolder: '.',
          },
        }, {
          fileUrl: `${HOST}/target/folder/targetfile2.jpg`,
          fileSize: 1999,
          blob: '<provided>',
          result: {
            fileName: 'targetfile2.jpg',
            fileSize: 1999,
            targetFolder: '/target/folder',
            targetFile: '/target/folder/targetfile2.jpg',
            mimeType: 'image/jpeg',
            sourceFile: '',
            sourceFolder: '.',
          },
        }],
        errors: [],
        retryErrors: [],
      });

      // verify that events are correct
      should(events.length).be.exactly(8);
      should(events[0].event).be.exactly('fileuploadstart');
      verifyFile1Event('filestart', events[1]);
      verifyFile2Event('filestart', events[2]);
      verifyFile1Event('fileprogress', events[3]);
      verifyFile2Event('fileprogress', events[4]);
      verifyFile1Event('fileend', events[5]);
      verifyFile2Event('fileend', events[6]);
      should(events[7].event).be.exactly('fileuploadend');
    });

    it('progress events', async () => {
      const targetFolder = '/target/progress_events';
      addDirectUpload(HOST, targetFolder, getTestUploadFiles().map((file) => file.fileName));

      const options = new DirectBinaryUploadOptions()
        .withUrl(`${HOST}${targetFolder}`)
        .withUploadFiles(getTestUploadFiles())
        .withConcurrent(false);

      const upload = new DirectBinaryUpload({
        ...getTestOptions(),
        progressDelay: 0,
      });
      monitorEvents(upload);

      await upload.uploadFiles(options);

      should(events.length).be.exactly(8);

      should(events[0].event).be.exactly('fileuploadstart');
      should(events[0].data.fileCount).be.exactly(2);
      should(events[0].data.totalSize).be.exactly(3023);
      should(events[1].event).be.exactly('filestart');
      should(events[1].data.fileName).be.exactly('targetfile.jpg');
      should(events[2].event).be.exactly('filestart');
      should(events[2].data.fileName).be.exactly('targetfile2.jpg');
      should(events[3].event).be.exactly('fileprogress');
      should(events[3].data.fileName).be.exactly('targetfile.jpg');
      should(events[3].data.transferred).be.exactly(1024);
      should(events[4].event).be.exactly('fileprogress');
      should(events[4].data.fileName).be.exactly('targetfile2.jpg');
      should(events[4].data.transferred).be.exactly(1999);
      should(events[5].event).be.exactly('fileend');
      should(events[5].data.fileName).be.exactly('targetfile.jpg');
      should(events[6].event).be.exactly('fileend');
      should(events[6].data.fileName).be.exactly('targetfile2.jpg');
      should(events[7].event).be.exactly('fileuploadend');
      should(events[7].data.fileCount).be.exactly(2);
      should(events[7].data.totalSize).be.exactly(3023);
      should(events[7].data.result).be.ok();
    });
  });
});
