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
