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

const {
  AEMUpload,
} = require('@adobe/httptransfer');
const httpTransferLogger = require('@adobe/httptransfer/lib/logger');
const { v4: uuid } = require('uuid');

const UploadOptionsBase = require('./upload-options-base');
const FileUploadResults = require('./file-upload-results');
const {
  getHttpTransferOptions,
} = require('./http-utils');

/**
 * Contains all logic for the process that uploads a set of files using direct binary access.
 *
 * The process will send events as a file is uploaded. Each event will be sent with
 * an object containing the following elements:
 * * {string} fileName: Name of the file being uploaded.
 * * {number} fileSize: Total size of the file, in bytes.
 * * {string} targetFolder: Full path to the AEM folder where the file is being
 *   uploaded.
 * * {string} targetFile: Full path to the file in AEM.
 * * {string} mimeType: Mime type of the file being uploaded.
 *
 * Some events may send additional pieces of information, which will be noted
 * in the event itself. The events are:
 *
 * * filestart: Sent when the first part of a file begins to upload.
 * * fileprogress: Sent periodically to report on how much of the file has
 *   uploaded. The event data will include these additional elements:
 *   * {number} transferred: The total number of bytes that have transferred for
 *     the file so far.
 * * fileend: Sent after the last part of a file has uploaded successfully. Will only
 *   be sent if the file transfers completely.
 * * filecancelled: Sent if the file was cancelled before it could finish.
 * * fileerror: Sent if one of the file's parts failed to transfer. The event data
 *   will include these additional elements:
 *   * {Array} errors: List of errors that occurred to prevent the upload.
 */
class DirectBinaryUploadProcess extends UploadOptionsBase {
  /**
   * Constructs a new instance of the upload process for a single directory.
   * @param {object} options Overall direct binary process options.
   * @param {DirectBinaryUploadOptions} uploadOptions Options specific to the
   *  current upload.
   */
  constructor(options, uploadOptions) {
    super(options, uploadOptions);

    this.fileResults = {};
    this.fileEvents = {};
    this.fileTransfer = {};
    this.completeUri = '';
    this.uploadId = uuid();

    const { log } = options;
    if (log) {
      httpTransferLogger.debug = (...args) => log.debug(...args);
      httpTransferLogger.info = (...args) => log.info(...args);
      httpTransferLogger.warn = (...args) => log.warn(...args);
      httpTransferLogger.error = (...args) => log.error(...args);
    }
  }

  /**
   * Retrieves a unique identifier that can be used to identify this particular upload.
   *
   * @returns {string} ID representing the upload.
   */
  getUploadId() {
    return this.uploadId;
  }

  /**
   * Retrieves the total size of the upload, which is determined based on the file size
   * specified on each upload file.
   *
   * @returns {number} Total size, in bytes.
   */
  getTotalSize() {
    let totalSize = 0;
    this.getUploadOptions().getUploadFiles().forEach((uploadFile) => {
      const { fileSize = 0 } = uploadFile;
      totalSize += fileSize;
    });
    return totalSize;
  }

  /**
   * Does the work of uploading all files based on the upload options provided to the process.
   *
   * @param {import('./upload-result')} uploadResult Result to which information about
   *  the upload will be added.
   * @returns {Promise} Resolves when all files have been uploaded.
   */
  async upload(uploadResult) {
    const aemUploadOptions = getHttpTransferOptions(this.getOptions(), this.getUploadOptions());
    const fileResults = new FileUploadResults(this.getOptions(), this.getUploadOptions());
    fileResults.addHttpTransferOptions(aemUploadOptions);
    const aemUpload = new AEMUpload();
    aemUpload.on('filestart', (data) => {
      this.logInfo(`Upload START '${data.fileName}': ${data.fileSize} bytes`);
      this.emit('filestart', data);
    });
    aemUpload.on('fileprogress', (data) => {
      this.logInfo(`Upload PROGRESS '${data.fileName}': ${data.transferred} of ${data.fileSize} bytes`);
      this.emit('fileprogress', data);
    });
    aemUpload.on('fileend', (data) => {
      this.logInfo(`Upload COMPLETE '${data.fileName}': ${data.fileSize} bytes`);
      fileResults.addFileEventResult(data);
      this.emit('fileend', data);
    });
    aemUpload.on('fileerror', (data) => {
      this.logError(`Upload FAILED '${data.fileName}': '${data.errors[0].message}'`);
      fileResults.addFileEventResult(data);
      this.emit('fileerror', data);
    });

    const fileCount = aemUploadOptions.uploadFiles.length;

    uploadResult.startTimer();

    this.logInfo(`sending ${fileCount} files to httptransfer`);
    await aemUpload.uploadFiles(aemUploadOptions);
    this.logInfo('successfully uploaded files with httptransfer');

    uploadResult.setFileUploadResults(fileResults);
    uploadResult.stopTimer();

    // output json result to logger
    this.logInfo(`Uploading result in JSON: ${JSON.stringify(uploadResult, null, 4)}`);
  }
}

module.exports = DirectBinaryUploadProcess;
