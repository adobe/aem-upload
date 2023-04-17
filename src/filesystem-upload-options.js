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

const DirectBinaryUploadOptions = require('./direct-binary-upload-options');
const { DefaultValues, RegularExpressions } = require('./constants');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');

/**
 * Options specific to a file system upload. Also supports all options defined by
 * DirectBinaryUploadOptions.
 */
class FileSystemUploadOptions extends DirectBinaryUploadOptions {
  constructor() {
    super();
    this.replaceValue = '-';
    this.folderNodeProcessor = async (name) => name.replace(
      RegularExpressions.INVALID_FOLDER_CHARACTERS_REGEX,
      this.replaceValue,
    ).toLowerCase();

    this.assetNodeProcessor = async (name) => name.replace(
      RegularExpressions.INVALID_ASSET_CHARACTERS_REGEX,
      this.replaceValue,
    );
  }

  /**
   * Creates a new FileSystemUploadOptions instance that will have the same options
   * as an existing options instance.
   * @param {DirectBinaryUploadOptions} uploadOptions Options whose value should
   *  be copied.
   */
  static fromOptions(uploadOptions) {
    const newOptions = new FileSystemUploadOptions();
    newOptions.options = { ...uploadOptions.options };
    newOptions.controller = uploadOptions.controller;

    if (uploadOptions.proxy) {
      newOptions.proxy = uploadOptions.proxy;
    }

    if (typeof (uploadOptions.replaceValue) === 'string') {
      newOptions.replaceValue = uploadOptions.replaceValue;
    }

    if (typeof (uploadOptions.folderNodeProcessor) === 'function') {
      newOptions.folderNodeProcessor = uploadOptions.folderNodeProcessor;
    }

    if (typeof (uploadOptions.assetNodeProcessor) === 'function') {
      newOptions.assetNodeProcessor = uploadOptions.assetNodeProcessor;
    }

    if (typeof (uploadOptions.uploadFileOptions) === 'object') {
      newOptions.uploadFileOptions = uploadOptions.uploadFileOptions;
    }

    return newOptions;
  }

  /**
   * Sets the maximum number of files that can be uploaded using the module at one time. If
   * the total number of files exceeds this number then the library will throw an exception
   * with code TOO_LARGE.
   * @param {*} maxFileCount
   * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
   */
  withMaxUploadFiles(maxFileCount) {
    this.options.maxUploadFiles = maxFileCount;
    return this;
  }

  /**
   * Sets a value indicating whether or not the process should upload all descendent
   * directories and files within the given directory.
   * @param {boolean} deepUpload True if the upload should be deep, false otherwise.
   * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
   */
  withDeepUpload(deepUpload) {
    this.options.deepUpload = deepUpload;
    return this;
  }

  /**
   * Sets a function that will be called before a folder is created in AEM. The given function
   * argument will be given the name of the folder as it appears on the file system, and should
   * return the name to use as the folder's node name in AEM.
   *
   * Regardless of the return value of the processor function, certain illegal characters will
   * always be removed from the node name. These include <code>/\.[]*:|</code>. The characters
   * will be replaced by the value set using withInvalidCharacterReplaceValue().
   *
   * The original folder name will be used as the AEM folder's title.
   *
   * The default behavior is to replace characters <code>%;#,+?^{}"</code> (and whitespace) with
   * the value set using withInvalidCharacterReplaceValue(), and to convert the name to lower
   * case.
   * @param {function} processorFunction Function that will receive a single argument - the
   *  name of a folder. Should return a Promise that resolves with the node name to use for
   *  the folder.
   * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
   */
  withFolderNodeNameProcessor(processorFunction) {
    this.folderNodeProcessor = processorFunction;
    return this;
  }

  /**
   * Sets a function that will be called before an asset is created in AEM. The given function
   * argument will be given the name of the asset as it appears on the file system, and should
   * return the name to use as the asset's node name in AEM.
   *
   * Regardless of the return value of the processor function, certain illegal characters will
   * always be removed from the node name. These include <code>/\.[]*:|</code>. The characters
   * will be replaced by the value set using withInvalidCharacterReplaceValue().
   *
   * The default behavior is to replace characters <code>#%{}?&</code> with the
   * value set using withInvalidCharacterReplaceValue().
   * @param {function} processorFunction Function that will receive a single argument - the
   *  name of an asset. Should return a Promise that resolves with the node name to use for
   *  the asset.
   * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
   */
  withAssetNodeNameProcessor(processorFunction) {
    this.assetNodeProcessor = processorFunction;
    return this;
  }

  /**
   * The value to use when replacing invalid characters in folder or asset node names.
   * @param {string} replaceValue Value to use when replacing invalid node name characters.
   *  Must not contain any of the invalid characters.
   * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
   */
  withInvalidCharacterReplaceValue(replaceValue) {
    if (RegularExpressions.INVALID_CHARACTERS_REGEX.test(replaceValue)) {
      throw new UploadError(
        'Invalid character replace value contains invalid characters',
        ErrorCodes.INVALID_OPTIONS,
      );
    }

    this.replaceValue = replaceValue;
    return this;
  }

  /**
   * Upload file options that will be applied to each file that is uploaded as
   * part of the file system upload. Most options that can be passed as part of
   * a single file upload using DirectBinaryUploadOptions.withUploadFiles() are
   * valid. The only exceptions are "fileName", "fileSize", "filePath", and
   * "blob", which will be ignored.
   *
   * @param {object} options Upload file options to apply to each file.
   */
  withUploadFileOptions(options) {
    this.uploadFileOptions = options;
    return this;
  }

  /**
   * Retrieves the maximum number of files that the module can upload in a single upload
   * request.
   *
   * @returns {number} Maximum file count.
   */
  getMaxUploadFiles() {
    return this.options.maxUploadFiles || DefaultValues.MAX_FILE_UPLOAD;
  }

  /**
   * Retrieves a value indicating whether the process should upload all descendent
   * directories and files within the given directory.
   * @returns {boolean} True for a deep upload, false otherwise.
   */
  getDeepUpload() {
    return !!this.options.deepUpload;
  }

  /**
   * Retrieves the function to use to get the node name for a folder to create
   * in AEM.
   * @returns {function} Function that expects a single folder name argument, and
   *  returns a Promise that will be resolved with a node name.
   */
  getFolderNodeNameProcessor() {
    return this.folderNodeProcessor;
  }

  /**
   * Retrieves the function to use to get the node name for an asset to create
   * in AEM.
   * @returns {function} Function that expects a single asset name argument, and
   *  returns a Promise that will be resolved with a node name.
   */
  getAssetNodeNameProcessor() {
    return this.assetNodeProcessor;
  }

  /**
   * Retrieves the value to use when replacing invalid characters in node names.
   * @returns {string} Replace value.
   */
  getInvalidCharacterReplaceValue() {
    return this.replaceValue;
  }

  /**
   * Retrieves the upload file options that will be applied to each file uploaded
   * through the module.
   *
   * @returns {object} Upload file options.
   */
  getUploadFileOptions() {
    return this.uploadFileOptions || {};
  }
}

module.exports = FileSystemUploadOptions;
