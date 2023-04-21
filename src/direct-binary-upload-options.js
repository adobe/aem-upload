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

const URL = require('url');

const { trimRight } = require('./utils');
const { DefaultValues } = require('./constants');

/**
 * Options that generally control how a direct binary upload will behave. The class contains
 * several optional configurations, but the minimal setup will require at least the following:
 *
 * ```js
 * const options = new DirectBinaryUploadOptions()
 *  .withUrl(uploadTargetUrl) // URL of the target of the upload
 *  .withUploadFiles(fileList) // list of files to upload
 * ```
 *
 * All other options are optional.
 */
class DirectBinaryUploadOptions {
  constructor() {
    this.options = {
      maxConcurrent: DefaultValues.MAX_CONCURRENT,
      retryCount: DefaultValues.RETRY_COUNT,
      retryDelay: DefaultValues.RETRY_DELAY,
      requestTimeout: DefaultValues.REQUEST_TIMEOUT,
    };
  }

  /**
   * Sets the URL to which binaries will be uploaded. The URL should include the path to
   * a directory. Depending on the context, this could be either a relative or absolute URL.
   * For example, running from a node.js process will require an absolute URL, whereas running
   * from a browser will allow relative URLs.
   *
   * @param {string} url The URL to which binaries will be uploaded.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withUrl(url) {
    this.options.url = url;
    return this;
  }

  /**
   * An array of object instances representing the files that will be uploaded
   * to the target URL.
   *
   * @param {Array} uploadFiles Files to upload to the target. Each file must contain
   *  at least the following properties: fileName, fileSize, and either filePath OR blob.
   *  See UploadFile for more information.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withUploadFiles(uploadFiles) {
    this.options.uploadFiles = uploadFiles;
    return this;
  }

  /**
   * Specifies whether or not the process will upload the files concurrently. If false, the
   * process will upload one file at a time. If true, the process will upload all files in
   * a concurrent "thread"-like manner. Default value is true.
   *
   * This is a convenience function that is wrapped around setting withMaxConcurrent() to
   * either 1 (if isConcurrent is false) or its default value (if isConcurrent is true).
   *
   * @param {boolean} isConcurrent True if the process should upload files concurrently, false if
   *  they should be uploaded serially.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withConcurrent(isConcurrent) {
    if (isConcurrent) {
      return this.withMaxConcurrent(5);
    }
    return this.withMaxConcurrent(1);
  }

  /**
   * Specifies the maximum number of HTTP requests to invoke at one time. Once this number of
   * pending requests is reached, no more requests will be submitted until at least one of the
   * pending requests finishes. A value less than 2 indicates that only one request at a time
   * is allowed, meaning that files will be uploaded serially instead of concurrently. Default
   * value is 5.
   *
   * @param {number} maxConcurrent Maximum number of pending HTTP requests to allow.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withMaxConcurrent(maxConcurrent) {
    this.options.maxConcurrent = maxConcurrent;
    return this;
  }

  /**
   * Specifies the options that will be used when submitting HTTP requests. The method will
   * merge the given options with any options provided in previous calls to the method,
   * and will pass the merged options as-is to fetch.
   *
   * @param {*} options Fetch options.
   * @returns {DirectBinaryUploadOptions} The current options instance, for chaining.
   */
  withHttpOptions(options) {
    const { headers: currHeaders } = this.getHttpOptions();
    const { headers: newHeaders } = options;

    const newOptions = {
      ...this.getHttpOptions(),
      ...options,
    };

    if (currHeaders && newHeaders) {
      newOptions.headers = {
        ...currHeaders,
        ...newHeaders,
      };
    }

    this.options.httpOptions = newOptions;

    return this;
  }

  /**
   * Specifies the number of times the process will attempt retrying a failed HTTP request before
   * giving up and reporting an error. Default: 3.
   *
   * @param {number} retryCount Number of times to resubmit a request.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withHttpRetryCount(retryCount) {
    this.options.retryCount = retryCount;
    return this;
  }

  /**
   * Sets the amount of time, in milliseconds, that the process will wait before retrying a
   * failed HTTP request. The delay will increase itself by this value each time the failed
   * request is resubmitted. For example, if the delay is 5,000 then the process will wait
   * 5,000 milliseconds for the first retry, then 10,000, then 15,000, etc. Default: 5,000.
   *
   * @param {number} retryDelay A timespan in milliseconds.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withHttpRetryDelay(retryDelay) {
    this.options.retryDelay = retryDelay;
    return this;
  }

  /**
   * Sets the maximum amount of time the module will wait for an HTTP request to complete
   * before timing out. Default: 1 minute.
   * @param {number} timeout Timeout duration, in milliseconds.
   * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
   */
  withHttpRequestTimeout(timeout) {
    this.options.requestTimeout = timeout;
    return this;
  }

  /**
   * Retrieves the target URL to which files will be uploaded.
   *
   * @returns {string} Target URL as provided to the options instance.
   */
  getUrl() {
    return trimRight(this.options.url, ['/']) || '/';
  }

  /**
   * Retrieves the path to the folder where the files will be uploaded. This value
   * is based on the URL that was provided to the options.
   *
   * The path value will not be URL encoded.
   *
   * @returns {string} Full path to a folder on the target.
   */
  getTargetFolderPath() {
    const { pathname } = URL.parse(this.getUrl());
    return decodeURIComponent(pathname);
  }

  /**
   * Retrieves the target URL's prefix, which is everything in the URL up to the target path.
   * Will be empty if there is no prefix.
   *
   * @returns {string} The target URL's prefix.
   */
  getUrlPrefix() {
    const {
      protocol,
      host,
    } = URL.parse(this.getUrl());

    return host ? `${protocol}//${host}` : '';
  }

  /**
   * Retrieves the list of files that will be uploaded.
   *
   * @returns {Array} List of UploadFile instances as provided to the options instance.
   */
  getUploadFiles() {
    return this.options.uploadFiles || [];
  }

  /**
   * Retrieves a value indicating whether or not the upload process will transfer files
   * concurrently.
   *
   * @returns {boolean} The value as provided to the options instance.
   */
  isConcurrent() {
    return this.getMaxConcurrent() > 1;
  }

  /**
   * Retrieves the maximum number of concurrent HTTP requests that should be allowed.
   *
   * @returns {number} Maximum number.
   */
  getMaxConcurrent() {
    return this.options.maxConcurrent;
  }

  /**
   * Retrieves the HTTP options that the upload process will use in each HTTP request that
   * it sends with fetch.
   * @returns {*} Fetch options.
   */
  getHttpOptions() {
    return this.options.httpOptions || {};
  }

  /**
   * Retrieves the number of times the process will attempt to resubmit a failed HTTP request.
   *
   * @returns {number} Retry count.
   */
  getHttpRetryCount() {
    return this.options.retryCount;
  }

  /**
   * Retrieves the amount of time, in milliseconds, the process wil wait between resubmitting
   * the same failed HTTP request.
   *
   * @returns {number} Timespan in milliseconds.
   */
  getHttpRetryDelay() {
    return this.options.retryDelay;
  }

  /**
   * Retrieves the maximum amount of time that the module will wait for an HTTP request to
   * complete before timing out.
   *
   * @returns {number} Timeout duration, in milliseconds.
   */
  getHttpRequestTimeout() {
    return this.options.requestTimeout;
  }

  /**
   * Overridden to return an object appropriate for representing this class as a
   * JSON object.
   *
   * @returns {object} The class's JSON representation.
   */
  toJSON() {
    const json = {
      ...this.options,
    };

    return json;
  }
}

module.exports = DirectBinaryUploadOptions;
