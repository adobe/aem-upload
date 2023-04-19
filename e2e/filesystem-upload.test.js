/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* eslint-env mocha */

const Path = require('path');
const should = require('should');

const {
  getTargetFolder,
  getTestOptions,
  setCredentials,
  doesAemPathExist,
  deleteAemPath,
  getPathTitle,
  createAemFolder,
  getAemEndpoint,
  verifyE2eResult,
} = require('./e2eutils');

const {
  DirectBinaryUploadOptions,
  FileSystemUploadOptions,
  FileSystemUpload,
} = require('..');

const ENCODED_ASSET1 = `${decodeURI('%ec%9d%b4%eb%91%90%e5%90%8f%e8%ae%80')}.jpg`;
const ENCODED_FOLDER = `folder_${decodeURI('%e2%99%82%e2%99%80%c2%b0%e2%80%b2%e2%80%b3%e2%84%83%ef%bc%84%ef%bf%a1%e2%80%b0%c2%a7%e2%84%96%ef%bf%a0%e2%84%a1%e3%88%b1')}`;
const ENCODED_ASSET2 = `${decodeURI('%e9%83%8e%e7%a4%bc')}.jpg`;

// eslint-disable-next-line func-names
describe('FileSystemUpload end-to-end tests', function () {
  this.timeout(1000 * 60);

  let events = [];

  function monitorEvents(upload) {
    upload.on('filestart', (data) => events.push({ event: 'filestart', data }));
    upload.on('fileprogress', (data) => events.push({ event: 'fileprogress', data }));
    upload.on('fileend', (data) => events.push({ event: 'fileend', data }));
    upload.on('fileerror', (data) => events.push({ event: 'fileerror', data }));
    upload.on('filecancelled', (data) => events.push({ event: 'filecancelled', data }));
    upload.on('foldercreated', (data) => events.push({ event: 'foldercreated', data }));
  }

  function hasEventCheck(eventName, targetFolder, path, pathFunc) {
    const checkPath = decodeURI(new URL(`${targetFolder}${path}`).pathname);
    for (let i = 0; i < events.length; i += 1) {
      const { event, data } = events[i];

      if (event === eventName && pathFunc(data) === checkPath) {
        return true;
      }
    }
    return false;
  }

  function hasEvent(eventName, targetFolder, filePath) {
    return hasEventCheck(eventName, targetFolder, filePath, (data) => data.targetFile);
  }

  function hasStartAndStopEvents(targetFolder, filePath) {
    const hasStart = hasEvent('filestart', targetFolder, filePath);
    const hasEnd = hasEvent('fileend', targetFolder, filePath);
    return hasStart && hasEnd;
  }

  async function verifyExistsInAemAndHasEvents(uploadOptions, filePath) {
    const exists = await doesAemPathExist(uploadOptions, filePath);
    const hasEvents = hasStartAndStopEvents(uploadOptions.getUrl(), filePath);
    should(exists).be.ok();
    should(hasEvents).be.ok();
  }

  async function verifyExistsInAemAndHasTitle(uploadOptions, filePath, title) {
    should(await doesAemPathExist(uploadOptions, filePath)).be.ok();
    should(await getPathTitle(uploadOptions, filePath)).be.exactly(title);
  }

  beforeEach(() => {
    events = [];
  });

  function buildFileResult(targetFolder, remotePath, localPath, fileSize) {
    const remoteDirectory = Path.posix.dirname(remotePath);
    const localDirectory = Path.dirname(localPath);
    const targetFolderPath = new URL(targetFolder).pathname;
    return {
      fileUrl: `${targetFolder}${encodeURI(remotePath)}`,
      fileSize,
      filePath: Path.join(__dirname, localPath),
      result: {
        fileName: Path.basename(remotePath),
        fileSize,
        targetFolder: `${targetFolderPath}${remoteDirectory !== '/' ? remoteDirectory : ''}`,
        targetFile: `${targetFolderPath}${remotePath}`,
        sourceFolder: Path.join(__dirname, localDirectory),
        sourceFile: Path.join(__dirname, localPath),
        mimeType: 'image/jpeg',
      },
    };
  }

  function buildFolderResult(targetFolder, folderPath, folderTitle, elapsedTime) {
    const targetFolderPath = new URL(targetFolder).pathname;
    return {
      elapsedTime,
      folderPath: `${targetFolderPath}${folderPath}`,
      folderTitle,
      retryErrors: [],
    };
  }

  it('shallow upload test', async () => {
    const targetFolder = getTargetFolder();
    const uploadOptions = new DirectBinaryUploadOptions()
      .withUrl(targetFolder);

    setCredentials(uploadOptions);

    const fileSystemUpload = new FileSystemUpload(getTestOptions());

    monitorEvents(fileSystemUpload);

    const uploadResult = await fileSystemUpload.upload(uploadOptions, [
      Path.join(__dirname, 'images/Dir 1'),
      Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
      Path.join(__dirname, 'images/Dir 1/subdir1/skiing_1.jpg'),
    ]);

    verifyE2eResult(targetFolder, uploadResult, {
      host: getAemEndpoint(),
      totalFiles: 6,
      totalTime: uploadResult.totalTime,
      totalCompleted: 6,
      totalFileSize: 1860489,
      folderCreateSpent: uploadResult.folderCreateSpent,
      errors: [],
      retryErrors: [],
      createdFolders: [],
      detailedResult: [
        buildFileResult(targetFolder, '/climber-ferrata-la-torre-di-toblin.jpg', '/images/climber-ferrata-la-torre-di-toblin.jpg', 414164),
        buildFileResult(targetFolder, '/skiing_1.jpg', '/images/Dir 1/subdir1/skiing_1.jpg', 561767),
        buildFileResult(targetFolder, '/freeride-steep.jpg', '/images/Dir 1/freeride-steep.jpg', 320669),
        buildFileResult(targetFolder, '/freeride.jpg', '/images/Dir 1/freeride.jpg', 102189),
        buildFileResult(targetFolder, '/ice-climbing.jpg', '/images/Dir 1/ice-climbing.jpg', 166077),
        buildFileResult(targetFolder, `/${ENCODED_ASSET1}`, `/images/Dir 1/${ENCODED_ASSET1}`, 295623),
      ],
    });

    await verifyExistsInAemAndHasEvents(uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/skiing_1.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/freeride.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/freeride-steep.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/ice-climbing.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, `/${ENCODED_ASSET1}`);
    should(await doesAemPathExist(uploadOptions, '/dir-1')).not.be.ok();

    return deleteAemPath(uploadOptions);
  });

  it('deep upload test', async () => {
    const targetFolder = getTargetFolder();
    const uploadOptions = new FileSystemUploadOptions()
      .withUrl(targetFolder)
      .withDeepUpload(true);

    setCredentials(uploadOptions);

    const fileSystemUpload = new FileSystemUpload(getTestOptions());

    monitorEvents(fileSystemUpload);

    const uploadResult = await fileSystemUpload.upload(uploadOptions, [
      Path.join(__dirname, 'images'),
      Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
      Path.join(__dirname, 'images/Dir 1/subdir1/skiing_1.jpg'),
    ]);
console.log(JSON.stringify({
  uploadResult,
  events,
}, null, 2));
    verifyE2eResult(targetFolder, uploadResult, {
      host: getAemEndpoint(),
      totalFiles: 13,
      totalTime: uploadResult.totalTime,
      totalCompleted: 13,
      totalFileSize: 3968893,
      folderCreateSpent: uploadResult.folderCreateSpent,
      errors: [],
      retryErrors: [],
      createdFolders: [
        buildFolderResult(targetFolder, '/images', 'images', uploadResult.createdFolders[2].elapsedTime),
        buildFolderResult(targetFolder, '/images/dir-1', 'Dir 1', uploadResult.createdFolders[3].elapsedTime),
        buildFolderResult(targetFolder, '/images/dir-1/folder_♂♀°′″℃＄￡‰§№￠℡㈱', 'folder_♂♀°′″℃＄￡‰§№￠℡㈱', uploadResult.createdFolders[4].elapsedTime),
        buildFolderResult(targetFolder, '/images/dir-1/subdir1', 'subdir1', uploadResult.createdFolders[5].elapsedTime),
        buildFolderResult(targetFolder, '/images/dir-1/subdir2', 'subdir2', uploadResult.createdFolders[6].elapsedTime),
      ],
      detailedResult: [
        buildFileResult(targetFolder, '/images/Freeride-extreme.jpg', '/images/Freeride#extreme.jpg', 246578),
        buildFileResult(targetFolder, '/images/climber-ferrata-la-torre-di-toblin.jpg', 'images/climber-ferrata-la-torre-di-toblin.jpg', 414164),
        buildFileResult(targetFolder, '/images/freeride-siberia.jpg', 'images/freeride-siberia.jpg', 282584),
        buildFileResult(targetFolder, '/images/dir-1/freeride-steep.jpg', '/images/Dir 1/freeride-steep.jpg', 320669),
        buildFileResult(targetFolder, '/images/dir-1/freeride.jpg', '/images/Dir 1/freeride.jpg', 102189),
        buildFileResult(targetFolder, '/images/dir-1/ice-climbing.jpg', '/images/Dir 1/ice-climbing.jpg', 166077),
        buildFileResult(targetFolder, '/images/dir-1/이두吏讀.jpg', '/images/Dir 1/이두吏讀.jpg', 295623),
        buildFileResult(targetFolder, '/images/dir-1/folder_♂♀°′″℃＄￡‰§№￠℡㈱/郎礼.jpg', '/images/Dir 1/folder_♂♀°′″℃＄￡‰§№￠℡㈱/郎礼.jpg', 161221),
        buildFileResult(targetFolder, '/images/dir-1/subdir1/ski touring.jpg', '/images/Dir 1/subdir1/ski touring.jpg', 196310),
        buildFileResult(targetFolder, '/images/dir-1/subdir1/skiing_2.jpg', '/images/Dir 1/subdir1/skiing_2.jpg', 245780),
        buildFileResult(targetFolder, '/images/dir-1/subdir1/skiing_1.jpg', '/images/Dir 1/subdir1/skiing_1.jpg', 561767),
        buildFileResult(targetFolder, '/climber-ferrata-la-torre-di-toblin.jpg', '/images/climber-ferrata-la-torre-di-toblin.jpg', 414164),
        buildFileResult(targetFolder, '/skiing_1.jpg', 'images/Dir 1/subdir1/skiing_1.jpg', 561767),
      ],
    });

    // files supplied directly
    await verifyExistsInAemAndHasEvents(uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/skiing_1.jpg');

    // images
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/climber-ferrata-la-torre-di-toblin.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/Freeride-extreme.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/freeride-siberia.jpg');

    // images/dir1
    await verifyExistsInAemAndHasTitle(uploadOptions, '/images/dir-1', 'Dir 1');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/freeride.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/freeride-steep.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/ice-climbing.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, `/images/dir-1/${ENCODED_ASSET1}`);

    // images/dir1/subdir1
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/subdir1/ski touring.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/subdir1/skiing_1.jpg');
    await verifyExistsInAemAndHasEvents(uploadOptions, '/images/dir-1/subdir1/skiing_2.jpg');

    // images/dir1/folder_♂♀°′″℃＄￡‰§№￠℡㈱
    await verifyExistsInAemAndHasEvents(uploadOptions, `/images/dir-1/${ENCODED_FOLDER}/${ENCODED_ASSET2}`);

    should(hasEventCheck('foldercreated', targetFolder, '/images/dir-1/subdir2', (data) => data.targetFolder)).be.ok();
    should(await doesAemPathExist(uploadOptions, '/images/dir-1/subdir2')).be.ok();

    return deleteAemPath(uploadOptions);
  });

  it('zero byte file test', async () => {
    const targetFolder = getTargetFolder();
    const uploadOptions = new FileSystemUploadOptions()
      .withUrl(targetFolder);

    setCredentials(uploadOptions);

    const fileSystemUpload = new FileSystemUpload(getTestOptions());

    monitorEvents(fileSystemUpload);

    await fileSystemUpload.upload(uploadOptions, [
      Path.join(__dirname, 'edge-case-images/zero-byte.jpg'),
    ]);
    should(events.length).be.exactly(2);
    should(events[0].event).be.exactly('foldercreated');
    should(events[1].event).be.exactly('fileerror');
  });

  it('GB18030 folder upload test', async () => {
    const folderName = `aem-upload-e2e_中文_${new Date().getTime()}`;
    const targetFolder = `${getAemEndpoint()}/content/dam`;
    const uploadOptions = new DirectBinaryUploadOptions()
      .withUrl(targetFolder);

    setCredentials(uploadOptions);

    await createAemFolder(uploadOptions, folderName);

    const fileSystemUpload = new FileSystemUpload(getTestOptions());

    monitorEvents(fileSystemUpload);

    const uploadUrl = `${targetFolder}/${encodeURI(folderName)}`;
    uploadOptions.withUrl(uploadUrl);

    const uploadResult = await fileSystemUpload.upload(uploadOptions, [
      Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
    ]);

    should(uploadResult).be.ok();

    await verifyExistsInAemAndHasEvents(uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');

    const doubleEncodedUrl = `${targetFolder}/${encodeURI(encodeURI(folderName))}`;
    uploadOptions.withUrl(doubleEncodedUrl);

    const doubleEncodedExists = await doesAemPathExist(uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
    should(doubleEncodedExists).not.be.ok();

    uploadOptions.withUrl(uploadUrl);
    return deleteAemPath(uploadOptions);
  });
});
