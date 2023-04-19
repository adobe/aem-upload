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

/**
 * Constant values that are used as defaults.
 */
module.exports.DefaultValues = {
  /**
   * The default number of maximum concurrent HTTP requests allowed by the library.
   */
  MAX_CONCURRENT: 5,

  /**
   * The default number of times the process will attempt submitting an HTTP request
   * before giving up and reporting a failure.
   */
  RETRY_COUNT: 3,

  /**
   * The amount of time, in milliseconds, that the process will wait between retries
   * of the same HTTP request. The delay will increase itself by this value for
   * each retry.
   */
  RETRY_DELAY: 5000,

  /**
   * Default timeout for HTTP requests: 1 minute.
   */
  REQUEST_TIMEOUT: 60000,

  /**
   * Maximum number of files allowed to be uploaded as part of the file system
   * upload process.
   */
  MAX_FILE_UPLOAD: 1000,
};

module.exports.RegularExpressions = {
  /**
   * Will match values that contain characters that are invalid in AEM node
   * names.
   */
  INVALID_CHARACTERS_REGEX: /[/:[\]|*\\]/g,

  /**
   * Will match values that contain characters that are invalid in AEM folder node
   * names.
   */
  INVALID_FOLDER_CHARACTERS_REGEX: /[.%;#+?^{}\s"&]/g,

  /**
   * Will match values that contain characters that are invalid in AEM asset node
   * names.
   */
  INVALID_ASSET_CHARACTERS_REGEX: /[#%{}?&]/g,
};

module.exports.HttpMethods = {
  POST: 'POST',
};
