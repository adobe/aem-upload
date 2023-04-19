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

const nock = require('nock');
const should = require('should');
const mime = require('mime');

/**
 * @typedef {DirectBinaryUploadInfo}
 * @property {Array} inits The init calls that were made by the test utils.
 * @property {Array} parts The part calls that were made by the test utils.
 * @property {Array} completes The complete calls that were made by the test utils.
 */

/**
 * @type {DirectBinaryUploadInfo}
 */
let uploadInfo;
let folderInfo;
let firstCheck = true;

function initializeUploadInfo() {
  firstCheck = true;
  uploadInfo = {
    inits: [],
    parts: [],
    completes: [],
  };
  folderInfo = [];
}

initializeUploadInfo();

function getConsoleLogger() {
  return {
    // eslint-disable-next-line no-console
    info: console.log,
    // eslint-disable-next-line no-console
    debug: console.log,
    // eslint-disable-next-line no-console
    warn: console.log,
    // eslint-disable-next-line no-console
    error: console.log,
  };
}

/**
 * Retrieves a test logger that will print messages to console.log.
 */
module.exports.getConsoleLogger = getConsoleLogger;

/**
 * Retrieves high level direct binary options that provide the ability
 * to output logs based on the state of the AEM_UPLOAD_TEST_LOGGING
 * environment variable.
 * @returns {object} Options for a direct binary operation.
 */
module.exports.getTestOptions = (addlOptions = {}) => {
  if (process.env.AEM_UPLOAD_TEST_LOGGING) {
    return {
      ...addlOptions,
      log: getConsoleLogger(),
    };
  }
  return addlOptions;
};

// stores events for monitorEvents().
let events = [];

/**
 * Monitors all file-related events for the given upload process. This includes
 * "filestart", "fileprogress", "fileend", "fileerror", and "filecancelled".
 * @param {EventEmitter} toMonitor Emitter to monitor.
 */
module.exports.monitorEvents = (toMonitor) => {
  events = [];
  toMonitor.on('filestart', (data) => events.push({ event: 'filestart', data }));
  toMonitor.on('fileprogress', (data) => events.push({ event: 'fileprogress', data }));
  toMonitor.on('fileend', (data) => events.push({ event: 'fileend', data }));
  toMonitor.on('fileerror', (data) => events.push({ event: 'fileerror', data }));
  toMonitor.on('filecancelled', (data) => events.push({ event: 'filecancelled', data }));
  toMonitor.on('foldercreated', (data) => events.push({ event: 'foldercreated', data }));
};

/**
 * Determines if an event with a matching "targetFile" value was emitted since the
 * last invocation of monitorEvents(). If found, the event's other data values will
 * be validated.
 * @param {string} eventName Name of the expected event.
 * @param {string} targetFile Value of the "targetFile" event data property for the
 *  expected event.
 * @returns {object|boolean} The event's data if found, otherwise false.
 */
module.exports.getEvent = (eventName, targetFile) => {
  for (let i = 0; i < events.length; i += 1) {
    const { event, data } = events[i];

    if (event === eventName && data.targetFile === targetFile) {
      const { fileName, targetFolder } = data;
      const lastSlash = targetFile.lastIndexOf('/');
      const expectedFileName = targetFile.substr(lastSlash + 1);
      const expectedTargetFolder = targetFile.substr(0, lastSlash);
      should(fileName).be.exactly(expectedFileName);
      should(targetFolder).be.exactly(expectedTargetFolder);

      return data;
    }
  }
  return false;
};

/**
 * Determines if an event with a matching "targetFolder" value was emitted since the
 * last invocation of monitorEvents(). If found, the event's other data values will
 * be validated.
 * @param {string} eventName Name of the expected event.
 * @param {string} targetFolder Value of the "targetFolder" event data property for the
 *  expected event.
 * @returns {object|boolean} The event's data if found, otherwise false.
 */
module.exports.getFolderEvent = (eventName, targetFolder) => {
  for (let i = 0; i < events.length; i += 1) {
    const { event, data } = events[i];

    if (event === eventName && data.targetFolder === targetFolder) {
      const { folderName, targetParent } = data;
      const lastSlash = targetFolder.lastIndexOf('/');
      const expectedFolderName = targetFolder.substr(lastSlash + 1);
      const expectedTargetParent = targetFolder.substr(0, lastSlash);
      should(folderName).be.exactly(expectedFolderName);
      should(targetParent).be.exactly(expectedTargetParent);

      return data;
    }
  }
  return false;
};

function buildLookup(data, keyField) {
  const lookup = {};
  data.forEach((item) => {
    lookup[item[keyField]] = item;
  });
  return lookup;
}

/**
 * Does the work of verifying the full result output of an upload. Strictly compares all values
 * in the result, while ensuring that the order in which folders or files were created will
 * not fail the comparison.
 * @param {*} result Upload result as provided by the module.
 * @param {*} expected Full expected output of the result.
 */
module.exports.verifyResult = (result, expected) => {
  const toVerify = { ...result };
  const toCompare = { ...expected };

  // this is special logic to ensure that order doesn't matter when comparing folder
  // and file data. the arrays will be converted into simple objects using a key
  // from each item in the array, then the lookups will be compared instead of
  // the arrays.
  const compareDirLookup = buildLookup(toCompare.createdFolders || [], 'folderPath');
  const compareFileLookup = buildLookup(toCompare.detailedResult || [], 'fileUrl');
  const verifyDirLookup = buildLookup(toVerify.createdFolders || [], 'folderPath');
  const verifyFileLookup = buildLookup(toVerify.detailedResult || [], 'fileUrl');
  delete toCompare.createdFolders;
  delete toCompare.detailedResult;
  delete toVerify.createdFolders;
  delete toVerify.detailedResult;

  should(toVerify).deepEqual(toCompare);
  should(toVerify.totalTime !== undefined).be.ok();
  should(toVerify.folderCreateSpent !== undefined).be.ok();
  should(verifyDirLookup).deepEqual(compareDirLookup);
  should(verifyFileLookup).deepEqual(compareFileLookup);

  const { createdFolders = [] } = toVerify;
  createdFolders.forEach((folder) => should(folder.elapsedTime !== undefined).be.ok());
};

/**
 * Clears all HTTP mocks created by the test utils.
 */
module.exports.resetHttp = () => {
  initializeUploadInfo();
  nock.cleanAll();
};

/**
 * Retrieves a value indicating whether all of the HTTP mocks created by the test
 * utils have been used.
 * @returns {boolean} True if all mocks have been used, false otherwise.
 */
module.exports.allHttpUsed = () => nock.isDone();

/**
 * Retrieves information about all of the mocked direct binary uploads that were
 * performed through the test utils.
 * @returns {DirectBinaryUploadInfo} Upload information.
 */
module.exports.getDirectBinaryUploads = () => uploadInfo;

/**
 * Retrieves information about all of the mocked folder creates that were
 * performed through the test utils.
 * @returns {Array} Upload information.
 */
module.exports.getFolderCreates = () => folderInfo;

/**
 * Creates mock HTTP requests necessary for successfully uploading using AEM's direct
 * binary upload process.
 *
 * @param {string} host Host on which the direct upload will be registered.
 * @param {string} targetFolder Full AEM folder path to which upload will be registered.
 * @param {Array<string>} fileNames Names of files to be uploaded.
 * @param {object} requests Simple object to which request information will be
 *  added.
 */
module.exports.addDirectUpload = (
  host,
  targetFolder,
  fileNames,
) => {
  nock.disableNetConnect();

  const files = fileNames.map((fileName) => {
    const partPath = `${encodeURI(targetFolder)}/${encodeURI(fileName)}`;
    const partUrl = `${host}${partPath}`;

    // success reply for part
    nock(host)
      .put(partPath)
      .reply(201, (uri, body) => uploadInfo.parts.push({ uri, body }));

    return {
      fileName,
      mimeType: mime.getType(fileName),
      uploadToken: `upload-token-${targetFolder}`,
      uploadURIs: [partUrl],
      minPartSize: 256,
      maxPartSize: 2048,
    };
  });

  const completeURI = `${encodeURI(targetFolder)}.completeUpload.json`;
  const initiatePath = `${encodeURI(targetFolder)}.initiateUpload.json`;

  // success reply for init
  nock(host)
    .post(initiatePath)
    .times(firstCheck ? 2 : 1) // twice for direct binary access enabled check
    .reply(201, (uri, body) => {
      uploadInfo.inits.push({ uri, body });
      return {
        completeURI,
        folderPath: targetFolder,
        files,
      };
    });

  // success reply for complete
  nock(host)
    .post(completeURI)
    .times(fileNames.length)
    .reply(201, (uri, body) => {
      uploadInfo.completes.push({ uri, body });
      return {};
    });
  firstCheck = false;
};

/**
 * Create mock HTTP requests necessary for a directory creation request.
 *
 * @param {string} host Host on which the directory will be created.
 * @param {string} directoryPath Full path to the directory to create.
 * @param {number} [status=201] Status code that will be included in the response.
 */
module.exports.addCreateDirectory = (host, directoryPath, status = 201) => {
  nock.disableNetConnect();

  nock(host)
    .post(`/api/assets${directoryPath}`)
    .reply(status, (uri, body) => folderInfo.push({ uri, body }));
};

/**
 * Parses a raw query string and converts it to a simple javascript object whose keys
 * are param names, and values are the param's value.
 * @param {string} query Query value to parse.
 * @returns {URLSearchParams} Parsed query parameters.
 */
module.exports.parseQuery = (query) => {
  const params = new URLSearchParams(query);
  const parsed = {};
  params.forEach((value, key) => {
    parsed[key] = value;
  });
  return parsed;
};
