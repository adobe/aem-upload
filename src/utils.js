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

import fs from './fs-promise';
import Async from 'async';
import Path from 'path';
import AsyncLock from 'async-lock';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';

import { DefaultValues } from './constants';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';
import UploadFile from './upload-file';

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
 * Loops through a given array, concurrently invoking the given callback. The loop will have a maximum
 * number of pending itemCallbacks at any one time. For example, if there are 100 items in the array
 * and 5 itemCallbacks are currently processing, then no more itemCallbacks will be invoked until
 * at least one of the pending itemCallbacks completes.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {number} [maxConcurrent] Optionally specify how many concurrent itemCallbacks are allowed.
 *  Default is 5.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been resolved.
 *  Will be resolved with an Array of all resolve values from the callback's Promises.
 */
export function concurrentLoop(loopArray, maxConcurrent, itemCallback) {
    let theMaxConcurrent = maxConcurrent;
    let theItemCallback = itemCallback;
    if (typeof maxConcurrent === 'function') {
        theItemCallback = maxConcurrent;
        theMaxConcurrent = DefaultValues.MAX_CONCURRENT;
    }

    return new Promise((resolve, reject) => {
        Async.eachOfLimit(loopArray, theMaxConcurrent, async (loopItem, index, itemDone) => {
            try {
                await theItemCallback(loopItem, index);
            } catch (e) {
                itemDone(e);
                return;
            }
            itemDone();
        }, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

/**
 * Loops through a given array, moving on to the next item in the array only when the Promise for
 * the current item has resolved.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been resolved.
 *  Will be resolved with an Array of all resolve values from the callback's Promises.
 */
export async function serialLoop(loopArray, itemCallback) {
    const itemResults = [];
    for (let i = 0; i < loopArray.length; i++) {
        itemResults.push(await itemCallback(loopArray[i], i));
    }
    return itemResults;
}

/**
 * Calculates the average of all the numbers in an array.
 *
 * @param {Array} values List of numbers for which to calculate an average.
 * @returns {number} The average value, rounded to zero decimal places.
 */
export function getAverage(values) {
    if (values.length) {
        const sum = values.reduce((x, y) => x + y);
        return Math.round(sum / values.length);
    }
    return 0;
}

/**
 * Utility method that provides a Promise interface for setTimeout().
 *
 * @param {number} delay The amount of time, in milliseconds, to wait before the method resolves.
 * @returns {Promise} Will be resolved when the specified delay has elapsed.
 */
export function setTimeoutPromise(delay) {
    return new Promise(res => {
        setTimeout(res, delay);
    });
}

/**
 * Retries an operation a given number of times, exponentially increasing the amount of time between each retry by a
 * specified interval.
 *
 * @param {object} retryOptions Determines the behavior of the retry functionality.
 * @param {number} [retryOptions.retryCount] Specifies how many times, in total, the operation will be retried before giving up.
 * @param {number} [retryOptions.retryDelay] Specifies the amount of time to wait before retrying. The actual wait time will
 *   exponentially increase by this value with each retry.
 * @param {function} [retryOptions.onRetryError] Will be invoked with a single error before each retry. If all retries fail, the
 *   method will resolved with the last error instead. If this function throws an exception then the retry functionality
 *   will immediately be resolved with the thrown exception.
 * @param {function} toRetry The operation to retry. The function is expected to return a Promise, which is resolved if
 *   the operation is successful and rejected with an error if the operation fails.
 * @returns {Promise} Will be resolved successfully if no exception is thrown by the operation withing the specified
 *   number of tries. Will be rejected with the last error if all retries fail.
 */
export async function exponentialRetry(options, toRetry) {
    if (typeof options === 'function') {
        toRetry = options;
        options = {};
    }

    const {
        retryCount = DefaultValues.RETRY_COUNT,
        retryDelay = DefaultValues.RETRY_DELAY,
        onRetryError = () => {},
    } = options;

    let lastErr = null;

    for (let i = 1; i <= retryCount; i += 1) {
        try {
            await toRetry();
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            if (i < retryCount) {
                onRetryError(e);
                await setTimeoutPromise(retryDelay * i);
            }
        }
    }

    if (lastErr) {
        throw lastErr;
    }
}

function buildCharRegex(charArray) {
    let regex = '[';

    charArray.forEach(char => {
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
export function trimRight(toTrim, charArray) {
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
export function trimLeft(toTrim, charArray) {
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
export function joinUrlPath(...theArguments) {
    let path = '';

    theArguments.forEach(arg => {
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
export function trimContentDam(path) {
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
export function normalizePath(path) {
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
export function isTempPath(path) {
    const tempPath = normalizePath(path);

    if (tempPath === '/') {
        return false;
    }

    let isTemp = TEMP_PATTERNS.some(pattern => pattern.test(tempPath));

    if (!isTemp) {
        const pathName = Path.basename(tempPath);
        isTemp = TEMP_NAME_PATTERNS.some(pattern => pattern.test(pathName));
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

function removeEmptyDirectories(directories, files) {
    const validDirectories = [];
    for (let d = 0; d < directories.length; d++) {
        const directory = directories[d];
        const directoryPrefix = Path.join(directory.path, '/');
        for (let f = 0; f < files.length; f++) {
            const file = files[f];
            if (file.path.startsWith(directoryPrefix)) {
                validDirectories.push(directory);
                break;
            }
        }
    }
    
    return validDirectories;
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
export async function walkDirectory(directoryPath, maximumPaths = 5000, includeDescendents = true) {
    let processDirectories = [{ path: directoryPath }];
    let allDirectories = [];
    let allFiles = [];
    let allErrors = [];
    let walkedTotalSize = 0;

    // this algorithm avoids recursion to prevent overflows. Instead,
    // use a stack to keep track of directories to process.
    while (processDirectories.length > 0) {
        const { path: toProcess } = processDirectories.shift();
        const directories = [];
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
        directories: removeEmptyDirectories(allDirectories, allFiles),
        files: allFiles,
        errors: allErrors,
        totalSize: walkedTotalSize
    }
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
export async function getLock(lockId, callback) {
    return lock.acquire(lockId, callback);
}

/**
 * Builds proxy agent options based on upload options. Note that the method may return a falsy value, which
 * indicates that a proxy does not apply.
 * @param {DirectBinaryUploadOptions} directBinaryUploadOptions Options from which to retrieve information.
 * @returns {object} Options for either http-proxy-agent or https-proxy-agent.
 */
export function getProxyAgentOptions(directBinaryUploadOptions) {
    const proxy = directBinaryUploadOptions.getHttpProxy();
    if (proxy) {
        const proxyOptions = proxy.getUrl();
        const user = proxy.getBasicAuthUser();
        const password = proxy.getBasicAuthPassword();
        if (user) {
            proxyOptions.auth = `${user}:${password}`;
        }
        return proxyOptions;
    }
    return false;
}

/**
 * Converts options provided in a DirectBinaryUploadOptions instance to a format
 * suitable to pass to the httptransfer module.
 * @param {object} options General upload object options.
 * @param {DirectBinaryUploadOptions} directBinaryUploadOptions Options to convert.
 */
export function getHttpTransferOptions(options, directBinaryUploadOptions) {
    // the httptransfer module accepts a full fileUrl instead of a single
    // url with individual file names. if needed, convert the format with a
    // single url and individual file names to the fileUrl format.
    const convertedFiles = directBinaryUploadOptions.getUploadFiles().map((uploadFile) => {
        const uploadFileInstance = new UploadFile(options, directBinaryUploadOptions, uploadFile);
        const transferOptions = uploadFileInstance.toJSON();
        if (uploadFile.blob) {
            // ensure blob is passed through to transfer options
            transferOptions.blob = uploadFile.blob;
        }
        return transferOptions;
    });

    const transferOptions = {
        uploadFiles: convertedFiles,
        headers: directBinaryUploadOptions.getHeaders(),
        concurrent: directBinaryUploadOptions.isConcurrent(),
        maxConcurrent: directBinaryUploadOptions.getMaxConcurrent(),
    };

    const proxyOptions = getProxyAgentOptions(directBinaryUploadOptions);
    if (proxyOptions) {
        const { protocol = 'http:' } = proxyOptions;
        transferOptions.requestOptions = {
            agent: protocol === 'https:' ? new HttpsProxyAgent(proxyOptions) : new HttpProxyAgent(proxyOptions)
        };
    }

    return transferOptions;
}

/**
 * Validates and retrieves basic authentication information from a set of options. Will throw an error
 * if only one of username or password is provided.
 * @param {object} options Options from which "username" and "password" properties will be retrieved.
 */
export function getBasicAuth(options) {
    const { username, password } = options;
    if (username && !password) {
        throw new UploadError('password is required for basic auth', ErrorCodes.INVALID_OPTIONS);
    }
    if (password && !username) {
        throw new UploadError('username is required for basic auth', ErrorCodes.INVALID_OPTIONS);
    }
    return options;
}
