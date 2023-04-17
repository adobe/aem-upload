/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import UploadBase from '../upload-base';

/**
 * Represents a response received from the HttpClient after submitting a request. Provides
 * various accessors for retrieving information from the response.
 */
export default class HttpResponse extends UploadBase {
  /**
   * Constructs a new response, which will use raw response values from the underlying
   * module that performs HTTP communication.
   *
   * @param {object} options Direct binary options.
   * @param {object} rawResponse Raw response data.
   */
  constructor(options, rawResponse) {
    super(options);

    this.rawResponse = rawResponse;
  }

  /**
   * Retrieves the HTTP status code of the response.
   *
   * @returns {number} HTTP status code.
   */
  getStatusCode() {
    return this.rawResponse ? this.rawResponse.status : 0;
  }

  /**
   * Retrieves the response status text.
   *
   * @returns {string} HTTP response status.
   */
  getStatusText() {
    return this.rawResponse ? this.rawResponse.statusText : '';
  }

  /**
   * Retrieves the response's header values.
   *
   * @returns {object} Simple object whose keys are header names
   *  and whose values are header values.
   */
  getHeaders() {
    return this.rawResponse ? this.rawResponse.headers || {} : {};
  }

  /**
   * Retrieves any data provided in the response body. Note that the
   * type of this value will vary depending on the response type set
   * on the request.
   *
   * @returns {*} Varies, depending on the request.
   */
  getData() {
    return this.rawResponse ? this.rawResponse.data : '';
  }

  /**
   * Retrieves the amount of time it took between the request being
   * sent and the server providing a response.
   *
   * @returns {number} Time span, in milliseconds.
   */
  getElapsedTime() {
    return this.rawResponse ? this.rawResponse.elapsedTime : 0;
  }
}
