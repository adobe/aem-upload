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

const UploadOptionsBase = require('./upload-options-base');
const UploadError = require('./upload-error');

class HttpResult extends UploadOptionsBase {
  /**
   * Constructs a new instance of the results, which can be used to add more information.
   */
  constructor(options, uploadOptions) {
    super(options, uploadOptions);

    this.retryErrors = [];
  }

  /**
   * Adds an error to the result's list of retry errors.
   *
   * @param {Error|string} e An error that occurred.
   */
  addRetryError(e) {
    this.retryErrors.push(UploadError.fromError(e));
  }

  /**
   * Retrieves the list of retry errors that occurred within the result's scope.
   *
   * @returns {Array} List of UploadError instances.
   */
  getRetryErrors() {
    return this.retryErrors;
  }

  /**
   * Converts the result to its JSON string representation.
   *
   * @returns {string} The result as a string.
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Converts the result to a simple object.
   *
   * @returns {object} Result information.
   */
  toJSON() {
    return {
      retryErrors: this.retryErrors,
    };
  }
}

module.exports = HttpResult;
