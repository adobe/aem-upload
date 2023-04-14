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

const Path = require('path');

const { DefaultValues, RegularExpressions } = require('./constants');
const { normalizePath } = require('./utils');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');

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
 * Uses a processor function to clean a node name, then cleans generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when replacing
 *  invalid characters.
 * @param {function} processorFunction Will be given the provided node name as a single argument.
 *  Expected to return a Promise that will be resolved with the clean node name value.
 * @param {string} nodeName Value to be cleaned of invalid characters.
 * @returns {Promise} Will be resolved with the cleaned node name.
 */
async function cleanNodeName(uploadOptions, processorFunction, nodeName) {
  const processedName = await processorFunction(nodeName);
  return processedName.replace(
    RegularExpressions.INVALID_CHARACTERS_REGEX,
    uploadOptions.getInvalidCharacterReplaceValue(),
  );
}

/**
 * Uses the given options to clean a folder name, then cleans generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when replacing
 *  invalid characters, and the function to call to clean the folder name.
 * @param {string} folderName Value to be cleaned of invalid characters.
 * @returns {Promise} Will be resolved with the clean name.
 */
async function cleanFolderName(uploadOptions, folderName) {
  return cleanNodeName(uploadOptions, uploadOptions.getFolderNodeNameProcessor(), folderName);
}

/**
 * Uses the given options to clean an asset name, then cleans generally disallowed characters
 * from the name.
 * @param {FileSystemUploadOptions} uploadOptions Used to retrieve the value to use when
 *  replacing invalid characters, and the function to call to clean the asset name.
 * @param {string} folderName Value to be cleaned of invalid characters.
 * @returns {Promise} Will be resolved with the clean name.
 */
async function cleanAssetName(uploadOptions, assetName) {
  const {
    name: assetNameOnly,
    ext,
  } = Path.parse(assetName);
  const cleanName = await cleanNodeName(
    uploadOptions,
    uploadOptions.getAssetNodeNameProcessor(),
    assetNameOnly,
  );
  return `${cleanName}${ext}`;
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
  isDeepUpload,
  getMaxFileCount,
  cleanFolderName,
  cleanAssetName,
  getItemManagerParent,
};
