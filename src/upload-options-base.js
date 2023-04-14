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

const UploadBase = require('./upload-base');

/**
 * Common base class for all classes that work with a DirectBinaryUploadOptions
 * instance.
 */
class UploadOptionsBase extends UploadBase {
  /**
   * Constructs a new instance using the provided information.
   *
   * @param {object} options Options as provided when the direct binary object was instantiated.
   * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the direct binary
   *   upload process was initiated.
   */
  constructor(options, uploadOptions) {
    super(options);
    this.uploadOptions = uploadOptions;
  }

  /**
   * Retrieves the upload options that were provided when the upload was initiated.
   *
   * @returns {DirectBinaryUploadOptions} Upload options.
   */
  getUploadOptions() {
    return this.uploadOptions;
  }
}

module.exports = UploadOptionsBase;
