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

import { DefaultValues } from './constants';
import { normalizePath } from './utils';

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
    const nRemovePathPrefix = normalizePath(removePathPrefix);
    const nLocalPath = normalizePath(localPath);
    const targetRoot = uploadOptions.getUrl();
    const isDeep = isDeepUpload(uploadOptions);

    if (isDeep && removePathPrefix && String(nLocalPath).startsWith(`${nRemovePathPrefix}/`)) {
        return `${targetRoot}${nLocalPath.substr(nRemovePathPrefix.length)}`;
    }

    return `${targetRoot}/${Path.basename(localPath)}`;
}

/**
 * Separates a list of files into a lookup based on its target remote path.
 *
 * @param {Array} files List of simple objects representing files. Is
 *  expected to at least have a "path" element.
 * @returns {object} Simple object whose keys are directory paths; values
 *  are an Array of objects as-is from the files parameter.
 */
function aggregateByRemoteDirectory(files) {
    const directoryAggregate = {};

    files.forEach(file => {
        const { remoteUrl } = file;
        const remoteDirectory = remoteUrl.substr(0, remoteUrl.lastIndexOf('/'));

        if (!directoryAggregate[remoteDirectory]) {
            directoryAggregate[remoteDirectory] = [];
        }
        directoryAggregate[remoteDirectory].push(file);
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

module.exports = {
    getItemRemoteUrl,
    aggregateByRemoteDirectory,
    isDeepUpload,
    getMaxFileCount,
}
