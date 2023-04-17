/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { getAverage } = require('./utils');
const UploadOptionsBase = require('./upload-options-base');

class FileUploadResults extends UploadOptionsBase {
  /**
   * Constructs a new instance using the provided information.
   *
   * @param {object} options Options as provided when the direct binary object was instantiated.
   * @param {import('./direct-binary-upload-options')} uploadOptions Options as provided
   *  when the direct binary upload process was initiated.
   */
  constructor(options, uploadOptions) {
    super(options, uploadOptions);
    this.fileLookup = {};
  }

  /**
   * Retrieves the total number of files that were included in the upload.
   * @returns {number} File count.
   */
  getTotalFileCount() {
    return Object.keys(this.fileLookup).length;
  }

  /**
   * Sets the node-httptransfer options that were used to upload a given file.
   * @param {*} transferOptions Options for node-httptransfer.
   */
  addHttpTransferOptions(transferOptions) {
    transferOptions.uploadFiles.forEach((uploadFile) => {
      const { fileUrl } = uploadFile;
      const targetPath = decodeURI(new URL(fileUrl).pathname);

      const fileInfo = { ...uploadFile };
      if (fileInfo.blob) {
        fileInfo.blob = '<provided>';
      }
      this.fileLookup[targetPath] = fileInfo;
    });
  }

  /**
   * Adds the result of a file transfer. Will be associated with the options
   * previously specified for a file through addHttpTransferOptions().
   * @param {*} data Event data as received from a node-httptransfer event.
   */
  addFileEventResult(data) {
    const { targetFile } = data;
    if (this.fileLookup[targetFile]) {
      this.fileLookup[targetFile].result = data;
    }
  }

  /**
   * Retrieves the total size, in bytes, of all files that were uploaded.
   * @returns {number} Size, in bytes.
   */
  getTotalSize() {
    return Object.keys(this.fileLookup)
      .map((file) => this.fileLookup[file].fileSize)
      .reduce((a, b) => a + b);
  }

  /**
   * Retrieves the average size, in bytes, of all files that were
   * uploaded.
   * @returns {number} Size, in bytes.
   */
  getAverageSize() {
    return getAverage(
      Object.keys(this.fileLookup)
        .map((file) => this.fileLookup[file].fileSize),
    );
  }

  /**
   * Retrieves the total number of files that uploaded successfully.
   * @returns {number} File count.
   */
  getSuccessCount() {
    let count = 0;
    Object.keys(this.fileLookup).forEach((file) => {
      const { result } = this.fileLookup[file];
      if (result) {
        const { errors } = result;
        if (errors === undefined) {
          count += 1;
        }
      }
    });
    return count;
  }

  /**
   * Retrieves an array of _all_ errors that were encountered as
   * files were transferred.
   * @returns {Array} Array of error information.
   */
  getErrors() {
    const allErrors = [];
    Object.keys(this.fileLookup).forEach((file) => {
      const { result } = file;
      if (result) {
        const { errors = [] } = result;
        errors.forEach((error) => allErrors.push(error));
      }
    });
    return allErrors;
  }

  /**
   * Converts the result into a simple javascript object containing all
   * of the result's information.
   * @returns Simple object.
   */
  toJSON() {
    return Object.keys(this.fileLookup).map((path) => this.fileLookup[path]);
  }
}

module.exports = FileUploadResults;
