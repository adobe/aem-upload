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

const { EventEmitter } = require('events');

/**
 * Base class providing common functionality for an upload based on options
 * provided to a direct binary access-related instance.
 */
class UploadBase extends EventEmitter {
  /**
   * Initializes a new upload instance with the given options.
   *
   * @param {object} [options] Options controlling the upload.
   * @param {Object} [options.log] The object to use for logging messages during the upload
   *  process. If specified, the object should contain methods info(), warn(), debug(), and
   *  error(). Log information will be passed as parameters to these methods.
   */
  constructor(options = {}) {
    super();
    this.options = options;
    this.log = options.log;
  }

  /**
   * Retrieves the options as passed to the upload process instance.
   *
   * @returns {object} Raw options.
   */
  getOptions() {
    return this.options;
  }

  /**
   * Uses the info() method of the provided logger to log information about the upload.
   */
  logInfo(...theArguments) {
    if (this.log) {
      this.log.info(...theArguments);
    }
  }

  /**
   * Uses the warn() method of the provided logger to log information about the upload.
   */
  logWarn(...theArguments) {
    if (this.log) {
      this.log.warn(...theArguments);
    }
  }

  /**
   * Uses the debug() method of the provided logger to log information about the upload.
   */
  logDebug(...theArguments) {
    if (this.log) {
      this.log.debug(...theArguments);
    }
  }

  /**
   * Uses the error() method of the provided logger to log information about the upload.
   */
  logError(...theArguments) {
    if (this.log) {
      this.log.error(...theArguments);
    }
  }

  /**
   * Sends an event to external consumers.
   *
   * @param {string} eventName The name of the event to send.
   * @param {object} eventData Will be included as the event's data.
   */
  sendEvent(eventName, eventData) {
    this.emit(eventName, eventData);
  }

  /**
   * Builds information about an upload, which will be included in upload-level
   * events sent by the uploader process.
   *
   * @param {import('./direct-binary-upload-process')} uploadProcess The
   *  upload process that will be performing the work of the upload.
   * @param {number} [directoryCount=0] If specified, the number of directories
   *  that will be created by the upload process.
   */
  // eslint-disable-next-line class-methods-use-this
  getUploadEventData(uploadProcess, directoryCount = 0) {
    return {
      uploadId: uploadProcess.getUploadId(),
      fileCount: uploadProcess.getUploadOptions().getUploadFiles().length,
      totalSize: uploadProcess.getTotalSize(),
      directoryCount,
    };
  }

  /**
   * Sends an event that will inform consumers that items are about to be uploaded.
   *
   * @param {import('./direct-binary-upload-process')} uploadProcess The
   *  upload process that will be performing the work of the upload.
   * @param {number} [directoryCount=0] If specified, the number of directories
   *  that will be created by the upload process.
   */
  beforeUploadProcess(uploadProcess, directoryCount = 0) {
    this.sendEvent('fileuploadstart', this.getUploadEventData(uploadProcess, directoryCount));
  }

  /**
   * Sends an event that will inform consumers that items have finished uploading.
   *
   * @param {import('./direct-binary-upload-process')} uploadProcess The
   *  upload process that will be performing the work of the upload.
   * @param {import('./upload-result')} uploadResult Result information
   *  about the upload.
   * @param {number} [directoryCount=0] If specified, the number of directories
   *  that will be created by the upload process.
   */
  afterUploadProcess(uploadProcess, uploadResult, directoryCount = 0) {
    this.sendEvent('fileuploadend', {
      ...this.getUploadEventData(uploadProcess, directoryCount),
      result: uploadResult.toJSON(),
    });
  }

  /**
   * Does the work of executing an upload of one or more files to AEM.
   *
   * @param {import('./direct-binary-upload-process')} uploadProcess The
   *  upload process that will be performing the work of the upload.
   * @param {import('./upload-result')} uploadResult Result information
   *  about the upload.
   * @returns {Promise} Resolves when the upload has finished.
   */
  async executeUploadProcess(uploadProcess, uploadResult) {
    uploadProcess.on('filestart', (data) => this.sendEvent('filestart', data));
    uploadProcess.on('fileprogress', (data) => this.sendEvent('fileprogress', data));
    uploadProcess.on('fileend', (data) => this.sendEvent('fileend', data));
    uploadProcess.on('fileerror', (data) => this.sendEvent('fileerror', data));
    uploadProcess.on('filecancelled', (data) => this.sendEvent('filecancelled', data));

    try {
      await uploadProcess.upload(uploadResult);
    } catch (uploadError) {
      uploadResult.addUploadError(uploadError);
    }
  }
}

module.exports = UploadBase;
