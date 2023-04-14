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

const fs = require('fs');
const Path = require('path');

const UploadOptionsBase = require('./upload-options-base');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');

/**
 * Analyzes the given file options and determines if there is sufficient information
 * to upload the file. If insufficient, the method will throw an exception.
 *
 * @param {object} options Information about the file to upload.
 */
function ensureRequiredOptions(options) {
  if (
    (!options.fileName && !options.fileUrl)
        || (!options.fileSize && options.fileSize !== 0)
        || (!options.filePath
            && (!options.blob || !options.blob.slice))
  ) {
    throw new UploadError('UploadFile missing required fields. Must have one of fileName or fileUrl, fileSize, and either filePath or blob', ErrorCodes.INVALID_OPTIONS);
  }
}

/**
 * Represents a file to upload, as provided in upload options. Includes information like the file's
 * name and size. Also provide capabilities for reading chunks of the file.
 */
class UploadFile extends UploadOptionsBase {
  /**
   * Constructs a new instance based on the given information.
   *
   * @param {object} options Options as provided when the direct binary upload was instantiated.
   * @param {DirectBinaryUploadOptions} uploadOptions  Options as provided when the upload was
   *   initiated.
   * @param {object} fileOptions Options for the specific file, as provided in the upload options.
   * @param {string} fileOptions.fileName The name of the file as it should appear when uploaded.
   * @param {number} fileOptions.fileSize Total size of the file to upload, in bytes.
   * @param {string} [fileOptions.filePath] Full path to the local filesystem file to upload.
   *   Either this value or "blob" must be provided.
   * @param {Array} [fileOptions.blob] Full binary content of the file to upload. Either this
   *   value or "filePath" must be provided.
   */
  constructor(options, uploadOptions, fileOptions) {
    super(options, uploadOptions);
    this.fileOptions = fileOptions;
  }

  /**
   * Retrieves the full URL of the file, based on the given upload options
   * and file options.
   *
   * @returns {string} URL of the file.
   */
  getFileUrl() {
    ensureRequiredOptions(this.fileOptions);

    let { fileUrl } = this.fileOptions;
    const { fileName } = this.fileOptions;

    if (!fileUrl) {
      fileUrl = `${this.getUploadOptions().getUrl()}/${encodeURIComponent(fileName)}`;
    }

    return fileUrl;
  }

  /**
   * Retrieves the name of the file as provided in the options.
   *
   * @returns {string} Name of the file.
   */
  getFileName() {
    ensureRequiredOptions(this.fileOptions);
    const name = Path.basename(new URL(this.getFileUrl()).pathname);
    return decodeURIComponent(name);
  }

  /**
   * Retrieves the size of the file, in bytes, as provided in the options.
   *
   * @returns {number} Size of the file.
   */
  getFileSize() {
    ensureRequiredOptions(this.fileOptions);
    return this.fileOptions.fileSize;
  }

  /**
   * Retrieves a value indicating whether or not a new version of the file should be
   * created if it already exists.
   *
   * @returns {boolean} True if a new version should be created, false otherwise.
   */
  shouldCreateNewVersion() {
    ensureRequiredOptions(this.fileOptions);
    return !!this.fileOptions.createVersion;
  }

  /**
   * Retrieves the label of the new version should one need to be created.
   *
   * @returns {string} A version label.
   */
  getVersionLabel() {
    ensureRequiredOptions(this.fileOptions);
    return this.fileOptions.versionLabel;
  }

  /**
   * Retrieves the comment of the new version should one need to be created.
   *
   * @returns {string} A version comment.
   */
  getVersionComment() {
    ensureRequiredOptions(this.fileOptions);
    return this.fileOptions.versionComment;
  }

  /**
   * Retrieves a value indicating whether or not the asset should be replaced if
   * it already exists.
   *
   * @returns {boolean} True if the asset should be replaced, false otherwise.
   */
  shouldReplace() {
    ensureRequiredOptions(this.fileOptions);
    return !!this.fileOptions.replace;
  }

  /**
   * Retrieves a chunk of the file for processing, based on the start and end
   * offset. The type of value returned by this method will vary depending on
   * the file options that were provided to the constructor.
   * @param {number} start Byte offset, inclusive, within the file where the chunk will begin.
   * @param {number} end Byte offset, exclusive, within the file where the chunk will end.
   * @returns {Readable|Array} If "filePath" was provided in the file options when constructed,
   *  then the return value will be a Readable stream. If "blob" was provided in the file options
   *  then the return value will be an Array.
   */
  getFileChunk(start, end) {
    ensureRequiredOptions(this.fileOptions);
    const {
      filePath,
      blob,
    } = this.fileOptions;

    if (filePath) {
      return fs.createReadStream(filePath, { start, end });
    }
    return blob.slice(start, end);
  }

  /**
   * Retrieves the headers that should be included with each part upload request.
   * @returns {object} Simple object whose names are header names, and whose values
   *  are header values.
   */
  getPartHeaders() {
    ensureRequiredOptions(this.fileOptions);
    const { partHeaders = {} } = this.fileOptions;
    return partHeaders;
  }

  /**
   * Converts the class instance into a simple object representation.
   *
   * @returns {object} Simplified view of the class instance.
   */
  toJSON() {
    const {
      fileSize,
      filePath,
    } = this.fileOptions;
    const json = {
      fileUrl: this.getFileUrl(),
      fileSize,
    };

    if (this.shouldCreateNewVersion()) {
      json.createVersion = true;
    }

    if (this.getVersionComment()) {
      json.versionComment = this.getVersionComment();
    }

    if (this.getVersionLabel()) {
      json.versionLabel = this.getVersionLabel();
    }

    if (this.shouldReplace()) {
      json.replace = this.shouldReplace();
    }

    if (filePath) {
      json.filePath = filePath;
    }
    if (Object.keys(this.getPartHeaders()).length) {
      json.multipartHeaders = this.getPartHeaders();
    }
    return json;
  }
}

module.exports = UploadFile;
