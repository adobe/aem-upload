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

const HttpResult = require('./http-result');
const UploadError = require('./upload-error');

/**
 * Represents results for the upload process as a whole, which might include multiple files. Results
 * include information such as total upload time, total file size, total number of files, etc.
 */
class UploadResult extends HttpResult {
  /**
   * Constructs a new instance of the results, which can be used to add more information.
   *
   * @param {object} options Options as provided when the upload instance was instantiated.
   * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the upload was
   *   initiated.
   */
  constructor(options, uploadOptions) {
    super(options, uploadOptions);

    this.totalTime = 0;
    this.fileUploadResults = false;
    this.createDirectoryResults = [];
    this.errors = [];
  }

  /**
   * Starts a timer that will be used to calculate the total amount of time it takes for the
   * upload process to complete.
   */
  startTimer() {
    this.start = new Date().getTime();
  }

  /**
   * Stops the timer and calculates the amount of time elapsed since startTimer() was called.
   */
  stopTimer() {
    if (this.start) {
      this.totalTime += new Date().getTime() - this.start;
    }
  }

  /**
   * Adds a new create directory to the overall result. Will be used to calculate various overall
   * metrics.
   *
   * @param {import('./create-directory-result')} createDirectoryResult Result whose
   *   metrics will be included in the overall result.
   */
  addCreateDirectoryResult(createDirectoryResult) {
    this.createDirectoryResults.push(createDirectoryResult);
  }

  /**
   * Retrieves all results for directories that were created as part of the upload.
   *
   * @returns {Array<import('./create-directory-result')>} Directory results.
   */
  getCreateDirectoryResults() {
    return this.createDirectoryResults;
  }

  /**
   * Retrieves the amount of time, in milliseconds, that it took to create any directories for the
   * upload.
   */
  getTotalFolderCreateTime() {
    let createTime = 0;
    this.getCreateDirectoryResults().forEach((directoryResult) => {
      createTime += directoryResult.getCreateTime();
    });
    return createTime;
  }

  /**
   * Sets information the individual file upload results that will be included in the final
   * output.
   * @param {import('./file-upload-results')} fileUploadResults File upload information.
   */
  setFileUploadResults(fileUploadResults) {
    this.fileUploadResults = fileUploadResults;
  }

  /**
   * Retrieves the total number of files initially included in the overall upload.
   *
   * @returns {number} Number of files.
   */
  getTotalFiles() {
    return this.fileUploadResults ? this.fileUploadResults.getTotalFileCount() : 0;
  }

  /**
   * Retrieves the number of files that uploaded successfully.
   *
   * @returns {number} Number of files.
   */
  getTotalCompletedFiles() {
    return this.fileUploadResults ? this.fileUploadResults.getSuccessCount() : 0;
  }

  /**
   * Retrieves the total amount of time, in milliseconds, that elapsed between calls to
   * startTimer() and stopTimer().
   *
   * @returns {number} Time span in milliseconds.
   */
  getElapsedTime() {
    return this.totalTime;
  }

  /**
   * Sets the total amount of time, in milliseconds, that it took for the upload to complete.
   *
   * @param {number} totalTime Time span in milliseconds.
   */
  setElapsedTime(totalTime) {
    this.totalTime = totalTime;
  }

  /**
   * Retrieves the total size, in bytes, of all files initially provided to the upload process.
   *
   * @returns {number} Size in bytes.
   */
  getTotalSize() {
    return this.fileUploadResults ? this.fileUploadResults.getTotalSize() : 0;
  }

  /**
   * Retrieves the average size, in bytes, of all files initially provided to the upload process.
   *
   * @returns {number} Size in bytes.
   */
  getAverageFileSize() {
    return this.fileUploadResults ? this.fileUploadResults.getAverageSize() : 0;
  }

  /**
   * Retrieves all the individual file upload results contained in the overall result.
   *
   * @returns {Array} List of file event infos.
   */
  getFileUploadResults() {
    return this.fileUploadResults ? this.fileUploadResults.toJSON() : [];
  }

  /**
   * Retrieves all the errors that occurred in the transfer process.
   *
   * @returns {Array} List of UploadError instances.
   */
  getErrors() {
    const errors = [...this.getUploadErrors()];
    const fileErrors = this.fileUploadResults ? this.fileUploadResults.getErrors() : [];
    return errors.concat(fileErrors);
  }

  /**
   * Adds a high-level error that prevented the upload from completing.
   *
   * @param {*} e An error object.
   */
  addUploadError(e) {
    this.errors.push(UploadError.fromError(e));
  }

  /**
   * Retrieves a list of high-level errors that prevented the upload from
   * completing.
   *
   * @returns {Array} An array of error objects.
   */
  getUploadErrors() {
    return this.errors;
  }

  /**
   * Converts the result instance into a simple object containing all result data.
   *
   * @returns {object} Result data in a simple format.
   */
  toJSON() {
    return {
      host: this.getUploadOptions().getUrlPrefix(),
      totalFiles: this.getTotalFiles(),
      totalTime: this.getElapsedTime(),
      totalCompleted: this.getTotalCompletedFiles(),
      totalFileSize: this.getTotalSize(),
      folderCreateSpent: this.getTotalFolderCreateTime(),
      createdFolders: this.getCreateDirectoryResults().map((result) => result.toJSON()),
      detailedResult: this.fileUploadResults ? this.fileUploadResults.toJSON() : [],
      errors: this.getUploadErrors().map((error) => error.toJSON()),
      ...super.toJSON(),
    };
  }
}

module.exports = UploadResult;
