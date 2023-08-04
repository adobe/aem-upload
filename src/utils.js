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

const Path = require('path');
const Async = require('async');
const AsyncLock = require('async-lock');
const fs = require('./fs-promise');

const { DefaultValues } = require('./constants');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');

const lock = new AsyncLock();

const TEMP_PATTERNS = [
  /^\/~(.*)/, // catch all paths starting with ~
  /^\/\.(.*)/, // catch all paths starting with .
];

const TEMP_NAME_PATTERNS = [
  /^[.~]/i,
  /^TestFile/, // InDesign: on file open, InDesign creates .dat.nosync* file, renames it TestFile, and deletes it
  /\.tmp$/i, // Illustrator: on save, creates one or more *.tmp files, renames them to original file name
  /\.~tmp$/i, // some default Windows applications use this file format
  // Windows
  /^desktop\.ini/i,
  /^Thumbs\.db/i,
  /^Adobe Bridge Cache\.bc$/i,
  /^Adobe Bridge Cache\.bct$/i,
];

/**
 * Loops through a given array, concurrently invoking the given callback. The loop will have a
 * maximum number of pending itemCallbacks at any one time. For example, if there are 100 items
 * in the array and 5 itemCallbacks are currently processing, then no more itemCallbacks will be
 * invoked until at least one of the pending itemCallbacks completes.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {number} [maxConcurrent] Optionally specify how many concurrent itemCallbacks are allowed.
 *  Default is 5.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been
 *  resolved. Will be resolved with an Array of all resolve values from the callback's Promises.
 */
function concurrentLoop(loopArray, maxConcurrent, itemCallback) {
  let theMaxConcurrent = maxConcurrent;
  let theItemCallback = itemCallback;
  if (typeof maxConcurrent === 'function') {
    theItemCallback = maxConcurrent;
    theMaxConcurrent = DefaultValues.MAX_CONCURRENT;
  }

  return new Promise((resolve, reject) => {
    Async.eachOfLimit(
      loopArray,
      theMaxConcurrent,
      async (loopItem, index) => theItemCallback(loopItem, index),
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

/**
 * Calculates the average of all the numbers in an array.
 *
 * @param {Array} values List of numbers for which to calculate an average.
 * @returns {number} The average value, rounded to zero decimal places.
 */
function getAverage(values) {
  if (values.length) {
    const sum = values.reduce((x, y) => x + y);
    return Math.round(sum / values.length);
  }
  return 0;
}

function buildCharRegex(charArray) {
  let regex = '[';

  charArray.forEach((char) => {
    if (char === '\\' || char === ']') {
      regex += '\\';
    }
    regex += char;
  });

  regex += ']';

  return regex;
}

/**
 * Removes a given set of characters from the end of a string.
 *
 * @param {string} toTrim The value to be trimmed.
 * @param {Array} charArray An array of single characters to trim.
 */
function trimRight(toTrim, charArray) {
  if (toTrim && toTrim.replace) {
    return toTrim.replace(new RegExp(`${buildCharRegex(charArray)}*$`, 'g'), '');
  }
  return toTrim;
}

/**
 * Removes a given set of characters from the beginning of a string.
 *
 * @param {string} toTrim The value to be trimmed.
 * @param {Array} charArray An array of single characters to trim.
 */
function trimLeft(toTrim, charArray) {
  if (toTrim && toTrim.replace) {
    return toTrim.replace(new RegExp(`^${buildCharRegex(charArray)}*`, 'g'), '');
  }
  return toTrim;
}

/**
 * Joins a list of values together to form a URL path. Each of the given values
 * is guaranteed to be separated from all other values by a forward slash.
 *
 * @param  {...string} theArguments Any number of parameters to join.
 */
function joinUrlPath(...theArguments) {
  let path = '';

  theArguments.forEach((arg) => {
    const toJoin = trimRight(trimLeft(arg, ['/']), ['/']);

    if (toJoin) {
      path += `/${toJoin}`;
    }
  });

  return path;
}

/**
 * Removes "/content/dam" from the beginning of a given path, if its
 * present. If the path equals "/content/dam" then the method will
 * return an empty string.
 *
 * @param {string} path The path to trim.
 */
function trimContentDam(path) {
  if (!path) {
    return path;
  }

  if (path === '/content/dam') {
    return '';
  }

  let trimmed = String(path);
  if (trimmed.startsWith('/content/dam/')) {
    trimmed = trimmed.substr('/content/dam'.length);
  }

  return trimRight(trimmed, ['/']);
}

/**
 * Normalizes a path by ensuring it only contains forward slashes and does not end with a
 * slash. If the given path is falsy then the method will return an empty string.
 * @param {string} path An item's full path.
 * @returns {string} Normalized version of a path.
 */
function normalizePath(path) {
  let normPath = path;
  if (normPath) {
    normPath = normPath.replace(/\\/g, '/');
    if (normPath.charAt(normPath.length - 1) === '/') {
      normPath = normPath.substr(0, normPath.length - 1);
    }
  }
  return normPath || '';
}

/**
 * Determines whether or not a given path is either a temp file, or in a temp directory.
 * @param {string} path A file system-like path.
 * @returns {boolean} True if the path is a temp file, false otherwise.
 */
function isTempPath(path) {
  const tempPath = normalizePath(path);

  if (tempPath === '/') {
    return false;
  }

  let isTemp = TEMP_PATTERNS.some((pattern) => pattern.test(tempPath));

  if (!isTemp) {
    const pathName = Path.basename(tempPath);
    isTemp = TEMP_NAME_PATTERNS.some((pattern) => pattern.test(pathName));
  }

  return isTemp;
}

/**
 * Concurrently loops through all items in a directory, doing a stat
 * on each to determine if it's a directory or file. The method will
 * skip temp files and directories.
 * @param {string} directoryPath Full path to the directory to iterate.
 * @param {Array} directories All of the target directory's valid sub-directories
 *  will be added to this array.
 * @param {Array} files All of the target directory's valid sub-files will be
 *  added to this array.
 * @param {Array} errors Any errors encountered while processing the directory will
 *  be added to this array.
 * @returns {number} Total size, in bytes, of all files in the directory.
 */
async function processDirectory(directoryPath, directories, files, errors) {
  let contents = false;

  let totalSize = 0;

  try {
    contents = await fs.readdir(directoryPath);
  } catch (e) {
    errors.push(e);
  }

  if (contents) {
    await concurrentLoop(contents, async (childPath) => {
      const fullChildPath = Path.join(directoryPath, childPath);
      if (!isTempPath(fullChildPath)) {
        let childStat;
        try {
          childStat = await fs.stat(fullChildPath);
        } catch (e) {
          errors.push(e);
          return;
        }

        if (childStat.isDirectory()) {
          directories.push({ path: fullChildPath });
        } else if (childStat.isFile()) {
          files.push({ path: fullChildPath, size: childStat.size });
          totalSize += childStat.size;
        }
      }
    });
  }

  return totalSize;
}

/**
 * Walks a directory by retrieving all the directories and files
 * in the given path, then walking all those sub directories, then
 * all sub directories of those sub directories, etc. The end result
 * will be the entire tree, including all descendents, for the
 * target directory.
 * @param {string} directoryPath Directory to traverse.
 * @param {number} [maximumPaths] The maximum number of paths to
 *  process before the method gives up and throws an exception.
 *  Default value is 5000.
 * @param {boolean} [includeDescendents] If true, the method will walk
 *  descendent directories. If false, the method will only include files
 *  immediately below the given directory. Default value is true.
 */
async function walkDirectory(directoryPath, maximumPaths = 5000, includeDescendents = true) {
  let processDirectories = [{ path: directoryPath }];
  let allDirectories = [];
  const allFiles = [];
  const allErrors = [];
  let walkedTotalSize = 0;

  // this algorithm avoids recursion to prevent overflows. Instead,
  // use a stack to keep track of directories to process.
  while (processDirectories.length > 0) {
    const { path: toProcess } = processDirectories.shift();
    const directories = [];
    // eslint-disable-next-line no-await-in-loop
    walkedTotalSize += await processDirectory(toProcess, directories, allFiles, allErrors);
    allDirectories = allDirectories.concat(directories);

    if (includeDescendents) {
      processDirectories = processDirectories.concat(directories);
    }

    if (allDirectories.length + allFiles.length > maximumPaths) {
      throw new UploadError(`Walked directory exceeded the maximum number of ${maximumPaths} paths`, ErrorCodes.TOO_LARGE);
    }
  }

  return {
    directories: allDirectories,
    files: allFiles,
    errors: allErrors,
    totalSize: walkedTotalSize,
  };
}

/**
 * Creates a "thread"-specific lock on a given ID. Other threads requesting
 * a lock on the same ID won't be able to run unless there are no other
 * threads holding the lock. Once a lock is obtained, the given callback is
 * invoked; the lock will be released when the callback has finished
 * executing. The method itself returns a promise, which will resolve once
 * the callback has completed.
 * @param {string} lockId ID for which an exclusive lock will be obtained.
 * @param {function} callback Invoked when the lock has been obtained. The
 *  lock will be released when the callback has finished executing. The callback
 *  can return a Promise, and the method will wait until the Promise resolves
 *  before releasing the lock.
 * @returns {Promise} Resolves after a lock has been obtained and the given
 *  callback has finished executing.
 */
async function getLock(lockId, callback) {
  return lock.acquire(lockId, callback);
}

module.exports = {
  concurrentLoop,
  getAverage,
  trimRight,
  trimLeft,
  joinUrlPath,
  trimContentDam,
  normalizePath,
  isTempPath,
  walkDirectory,
  getLock,
};
