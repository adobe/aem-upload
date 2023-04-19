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

/**
 * Represents the results of the creation of a directory. These results contain information such as
 * the amount of time it took to create, and any error that may have occurred.
 */
class CreateDirectoryResult extends HttpResult {
  /**
   * Constructs a new instance using the provided information. Can then be used to provide
   * additional details as needed.
   *
   * @param {object} options Options as provided when the upload instance was instantiated.
   * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the upload was
   *  initiated.
   * @param {string} folderPath Full path of the folder that was created.
   * @param {string} folderTitle Full title of the folder that was created.
   * @param {*} response Response to the create request from the underlying client.
   */
  constructor(options, uploadOptions, folderPath, folderTitle) {
    super(options, uploadOptions);

    this.folderPath = folderPath;
    this.folderTitle = folderTitle;
    this.response = false;
    this.error = false;
  }

  /**
   * Sets the response to the create request.
   *
   * @param {*} response Response to the create request from the underlying client.
   */
  setCreateResponse(response) {
    this.response = response;
  }

  /**
   * Sets the error that was the result of the create request.
   *
   * @param {import('./upload-error')} error Error to the create request.
   */
  setCreateError(error) {
    this.error = error;
  }

  /**
   * Retrieves the full path of the folder as it was created in AEM.
   *
   * @returns {string} Path of a folder.
   */
  getFolderPath() {
    return this.folderPath;
  }

  /**
   * Retrieves the title of the folder as it was created in AEM.
   *
   * @returns {string} Title of a folder.
   */
  getFolderTitle() {
    return this.folderTitle;
  }

  /**
   * Retrieves the amount of time, in milliseconds, it took to create the folder.
   *
   * @returns {number} Time span in milliseconds.
   */
  getCreateTime() {
    if (this.response && this.response.cloudClient) {
      return this.response.cloudClient.requestTime;
    }
    return 0;
  }

  /**
   * Converts the result instance into a simple object containing all result data.
   *
   * @returns {object} Result data in a simple format.
   */
  toJSON() {
    const json = {
      elapsedTime: this.getCreateTime(),
      folderPath: this.getFolderPath(),
      folderTitle: this.getFolderTitle(),
      ...super.toJSON(),
    };

    if (this.error) {
      json.error = this.error.toJSON();
    }
    return json;
  }
}

module.exports = CreateDirectoryResult;
