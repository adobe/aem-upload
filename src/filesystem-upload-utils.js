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

import Path from 'path';

import { DefaultValues, RegularExpressions } from './constants';
import { normalizePath } from './utils';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';

/**
 * Retrieves the option indicating whether or not the upload is deep. Takes
 * into account that the options might not be FileSystemUploadOptions.
 * @param {FileSystemUploadOptions|DirectBinaryUploadOptions} uploadOptions Options
 *  to retrieve value from.
 * @returns {boolean} True if it's a deep upload, false otherwise.
 */
function isDeepUpload(uploadOptions) {
    if (!uploadOptions.getDeepUpload) {
        // default to false if the class received an options instance
        // not of type FileSystemUploadOptions.
        return false;
    }
    return uploadOptions.getDeepUpload();
}

/**
 * Retrieves the remote path for an item to upload. Removes a local
 * prefix from its path, then appends the result to the target
 * path from the given options.
 *
 * @param {DirectBinaryUploadOptions} uploadOptions Will be used to determine
 *  the behavior of the method.
 * @param {string} removePathPrefix Will be removed from the given local path
 *  if present.
 * @param {string} localPath Full path to a local item.
 * @returns {string} Remote path to the item.
 */
function getItemRemoteUrl(uploadOptions, removePathPrefix, localPath) {
    const normalizedRemovePathPrefix = normalizePath(removePathPrefix);
    const normalizedLocalPath = normalizePath(localPath);
    const targetRoot = uploadOptions.getUrl();
    const isDeep = isDeepUpload(uploadOptions);

    if (isDeep && removePathPrefix && String(normalizedLocalPath).startsWith(`${normalizedRemovePathPrefix}/`)) {
        return `${targetRoot}${normalizedLocalPath.substr(normalizedRemovePathPrefix.length)}`;
    }

    return `${targetRoot}/${Path.basename(localPath)}`;
}

/**
 * Separates a list of files into a lookup based on its target remote path.
 *
 * @param {Array} files List of simple objects representing files. Is
 *  expected to at least have a "remoteUrl" element, which is expected
 *  to be normalized and not end with a forward slash. For example:
 *  http://adobe.com/myfile.jpg is valid, whereas http://adobe.com/myfile.jpg/
 *  is not valid.
 * @returns {object} Simple object whose keys are directory paths; values
 *  are an Array of objects as-is from the files parameter.
 */
function aggregateByRemoteDirectory(files) {
    const directoryAggregate = {};

    files.forEach(file => {
        const remoteDirectory = file.getParentRemoteUrl();

        if (!directoryAggregate[remoteDirectory]) {
            directoryAggregate[remoteDirectory] = new Set();
        }
        directoryAggregate[remoteDirectory].add(file);
    });
    return directoryAggregate;
}

/**
 * Retrieves the option specifying the maximum number of files that can be
 * uploaded at once. Takes into account that the options might not be
 * FileSystemUploadOptions.
 * @param {FileSystemUploadOptions|DirectBinaryUploadOptions} uploadOptions Options
 *  to retrieve value from.
 * @returns {number} Maximum number of files to upload.
 */
function getMaxFileCount(uploadOptions) {
    if (!uploadOptions.getMaxUploadFiles) {
        return DefaultValues.MAX_FILE_UPLOAD;
    }
    return uploadOptions.getMaxUploadFiles();
}

/**
 * Uses a processor function to cleanse a node name, then cleanses generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when replacing
 *  invalid characters.
 * @param {function} processorFunction Will be given the provided node name as a single argument.
 *  Expected to return a Promise that will be resolved with the cleansed node name value.
 * @param {string} nodeName Value to be cleansed of invalid characters.
 * @returns {Promise} Will be resolved with the cleansed node name.
 */
async function cleanseNodeName(uploadOptions, processorFunction, nodeName) {
    const processedName = await processorFunction(nodeName);
    return processedName.replace(RegularExpressions.INVALID_CHARACTERS_REGEX,
        uploadOptions.getInvalidCharacterReplaceValue());
}

/**
 * Uses the given options to cleanse a folder name, then cleanses generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when replacing
 *  invalid characters, and the function to call to cleanse the folder name.
 * @param {string} folderName Value to be cleansed of invalid characters.
 * @returns {Promise} Will be resolved with the cleansed name.
 */
async function cleanseFolderName(uploadOptions, folderName) {
    return cleanseNodeName(uploadOptions, uploadOptions.getFolderNodeNameProcessor(), folderName);
}

/**
 * Uses the given options to cleanse an asset name, then cleanses generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when replacing
 *  invalid characters, and the function to call to cleanse the asset name.
 * @param {string} folderName Value to be cleansed of invalid characters.
 * @returns {Promise} Will be resolved with the cleansed name.
 */
async function cleanseAssetName(uploadOptions, assetName) {
    const {
        name: assetNameOnly,
        ext,
    } = Path.parse(assetName);
    const cleansedName = await cleanseNodeName(uploadOptions, uploadOptions.getAssetNodeNameProcessor(), assetNameOnly);
    return `${cleansedName}${ext}`;
}

async function getItemManagerParent(itemManager, rootPath, localPath) {
    const normalizedPath = normalizePath(localPath);
    let parent;

    if (normalizedPath !== rootPath && !String(normalizedPath).startsWith(`${rootPath}/`)) {
        throw new UploadError('directory to upload is outside expected root', ErrorCodes.INVALID_OPTIONS);
    }

    if (normalizedPath !== rootPath) {
        parent = await itemManager.getDirectory(normalizedPath.substr(0, normalizedPath.lastIndexOf('/')));
    }

    return parent;
}

module.exports = {
    getItemRemoteUrl,
    aggregateByRemoteDirectory,
    isDeepUpload,
    getMaxFileCount,
    cleanseFolderName,
    cleanseAssetName,
    getItemManagerParent,
}
