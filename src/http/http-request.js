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

import { Readable } from 'stream';
import UploadBase from '../upload-base';
import { DefaultValues } from '../constants';
import UploadError from '../upload-error';
import ErrorCodes from '../error-codes';

/**
 * Represents a request that can be sent via HTTP using the HttpClient. Options on
 * the request can be set via chaining its "with" methods together.
 */
class HttpRequest extends UploadBase {
  /**
   * Constructs a new request using the given values. Default method
   * is GET.
   * @param {object} options
   * @param {string} url URL to which the request will be sent.
   */
  constructor(options, url) {
    super(options);

    this.requestOptions = {
      url,
      method: HttpRequest.Method.GET,
      timeout: DefaultValues.REQUEST_TIMEOUT,
    };
    this.headers = {};
    this.cancelId = '';
    this.totalTransferred = 0;
  }

  /**
   * Sets various configurations of the request based on the values provided
   * in the given upload options.
   * @param {DirectBinaryUploadOptions} uploadOptions Options to use when
   *  configuring request.
   * @returns The current request instance, so that methods can be chained.
   */
  withUploadOptions(uploadOptions) {
    if (uploadOptions.getHttpProxy()) {
      this.withProxy(uploadOptions.getHttpProxy());
    }
    return this.withHeaders(uploadOptions.getHeaders())
      .withTimeout(uploadOptions.getHttpRequestTimeout());
  }

  /**
   * Sets information about the proxy that will be used for the request.
   * @param {HttpProxy} proxy Proxy to use.
   */
  withProxy(proxy) {
    this.requestOptions.proxy = proxy.toHttpOptions();
    return this;
  }

  /**
   * Sets the amount of time, in milliseconds, that the request will wait before
   * timing out.
   * @param {number} timeoutMilliseconds Time span in milliseconds.
   * @returns The current request instance, so that methods can be chained.
   */
  withTimeout(timeoutMilliseconds) {
    this.requestOptions.timeout = timeoutMilliseconds;
    return this;
  }

  /**
   * Sets the HTTP method that the request will use.
   *
   * @param {Method} method The HTTP method of the request. Should be one of
   *  the class's static Method values.
   * @returns The current request instance, so that methods can be chained.
   */
  withMethod(method) {
    this.requestOptions.method = method;
    return this;
  }

  /**
   * Sets the content type of the request.
   *
   * @param {string} contentType HTTP content type.
   * @returns The current request instance, so that methods can be chained.
   */
  withContentType(contentType) {
    this.headers['Content-Type'] = contentType;
    return this;
  }

  /**
   * Sets the headers that the request will use. Will be merged with any
   * other headers that have already been set on the request.
   *
   * @param {object} headers Simple object whose keys should be header names,
   *  and whose values should be header values.
   * @returns The current request instance, so that methods can be chained.
   */
  withHeaders(headers) {
    this.headers = {
      ...this.headers,
      ...headers,
    };
    return this;
  }

  /**
   * Sets raw data that will be sent in the body of the request. The type of the data
   * can vary, and accepted types are shown on the rawData parameter.
   *
   * This option is only applicable for PUT and POST.
   *
   * If data is provided, then the request will emit an event named "progress" whenever
   * there has been a meaninful amount of data uploaded. The event's data will be the
   * amount of data, in bytes, that has transferred since the last time the event was
   * sent.
   *
   * @param {*} rawData Data to send in the request's body. Valid types: string|object|
   *  ArrayBuffer|ArrayBufferView|URLSearchParams|FormData|File|Blob|Stream|Buffer
   * @param {number} [dataSize] The total size, in bytes, of the provided data. If not provided
   *  then the request will attempt to derive the size from the data, but note that this may
   *  fail for some data types.
   * @returns The current request instance, so that methods can be chained.
   */
  withData(rawData, dataSize = 0) {
    this.requestOptions.data = rawData;

    if (rawData.on) {
      // in Axios, the "onUploadProgress" option only works in a Browser. In
      // Node.js, use the Stream's events to report progress
      rawData.on('data', (chunk) => {
        this.sendProgressEvent(chunk.length, true);
      });
    } else {
      // only available in a Browser.
      this.requestOptions.onUploadProgress = (progress) => {
        const { loaded } = progress;
        if (loaded) {
          this.sendProgressEvent(loaded, false);
        }
      };
    }

    if (rawData && (rawData instanceof Readable)) {
      if (dataSize) {
        this.logDebug('Adding content-length header for size', dataSize);
        this.withHeaders({
          'Content-Length': dataSize,
        });
      } else {
        throw new UploadError('Request data objects without a length must specify a size', ErrorCodes.INVALID_OPTIONS);
      }
    }

    return this;
  }

  /**
   * Sets the type of response expected from the server. Should be one of the
   * class's static ResponseType values.
   * @param {string} responseType Type of response to expect. Default: JSON.
   * @returns The current request instance, so that methods can be chained.
   */
  withResponseType(responseType) {
    this.requestOptions.responseType = responseType;
    return this;
  }

  /**
   * Specifies an identifier that can be used in the HttpClient's cancel() method to cancel
   * this request. Note that the ID doesn't need to be unique to the request.
   *
   * @param {string} cancelId Used to cancel the request, if needed.
   * @returns The current request instance, so that methods can be chained.
   */
  withCancelId(cancelId) {
    this.cancelId = cancelId;
    return this;
  }

  /**
   * Retrieves the ID that was set using the request's withCancelId() method.
   *
   * @returns The request's cancel ID.
   */
  getCancelId() {
    return this.cancelId;
  }

  /**
   * Sends a 'progress' event for the request, which will include the
   * incremental amount of data transferred.
   * @param {number} transferred Amount of bytes transferred. This could
   *  be the total amount, or an incremental amount since the last event,
   *  depending on the isIncremental parameter.
   * @param {boolean} isIncremental If true, the transferred value is an
   *  incremental amount since the last event; otherwise it's the total
   *  amount transferred.
   */
  sendProgressEvent(transferred, isIncremental) {
    let incLoaded = transferred;

    if (isIncremental) {
      this.totalTransferred += transferred;
    } else {
      incLoaded = transferred - this.totalTransferred;
      this.totalTransferred = transferred;
    }

    this.sendEvent('progress', { transferred: incLoaded });
  }

  /**
   * Converts the request to a simple object.
   * @returns {object} Object containing the request's information.
   */
  toJSON() {
    return {
      headers: this.headers,
      ...this.requestOptions,
    };
  }
}

/**
 * Available HTTP method that can be used for the request.
 */
HttpRequest.Method = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  HEAD: 'head',
  DELETE: 'delete',
};

/**
 * Valid values that can be used for the withResponseType() method.
 */
HttpRequest.ResponseType = {
  ARRAY_BUFFER: 'arraybuffer',
  DOCUMENT: 'document',
  JSON: 'json',
  TEXT: 'text',
  STREAM: 'stream',
  BLOB: 'blob',
};

export default HttpRequest;
