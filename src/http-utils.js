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

import axios, { CancelToken } from 'axios';
import cookie from 'cookie';
import URL from 'url';
import https from 'https';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';

import { exponentialRetry } from './utils';
import UploadFile from './upload-file';

/**
 * Retrieves a token that can be used to cancel an http request.
 *
 * @returns {Object} Used to cancel an HTTP request.
 */
function createCancelToken() {
    return CancelToken.source();
}

/**
 * Submits an HTTP requests and provides the amount of time it took (in milliseconds) for the request to complete.
 * In addition, the method will retry the request according to the provided retry options.
 *
 * @param {object} requestOptions Will be passed as-is to the underlying HTTP request processor, axios.
 * @param {object} retryOptions Determines the behavior of the retry functionality.
 * @param {number} [retryOptions.retryCount] Specifies how many times, in total, the request will be submitted before giving up.
 * @param {number} [retryOptions.retryDelay] Specifies the amount of time to wait before retrying. The actual wait time will
 *   exponentially increase by this value for each retry.
 * @param {function} [retryOptions.onRetryError] Will be invoked with a single error before each retry. If all retries fail, the
 *   method will resolved with the last error instead. If this function throws an exception then the retry functionality
 *   will immediately be resolved with the thrown exception.
 * @param {Object} [cancelToken] If specified, can be used to cancel the request.
 * @returns {object} The response to the request, which will match the signature of an axios response. In addition
 *  to typical axios response data, the object will also have an "elapsedTime" property containing the amount
 *  of time (in milliseconds) it took for the request to complete.
 */
async function timedRequest(requestOptions, retryOptions, cancelToken) {
    const reqStart = new Date().getTime();
    const options = { ...requestOptions };

    if (options.onRetryError) {
        delete options.onRetryError;
    }

    if (cancelToken) {
        options.cancelToken = cancelToken.token;
    }

    let response;

    // assemble http(s) agent options, which can contain entries for proxy,
    //  strictSSL/rejectUnauthorized, or both
    const { protocol = 'http:' } = URL.parse(options.url);
    if (options.proxy) {
      const agentOptions = {};

      // TODO: figure out how to assemble proxy url
      agentOptions.proxy = `${options.proxy.protocol}://${options.proxy.host}:${options.proxy.port}/`;

      // need to clear this property since it does not work for axios (see https://github.com/axios/axios/issues/2072)
      options.proxy = false;

      if (typeof options.strictSSL !== 'undefined') {
        agentOptions.rejectUnauthorized = options.strictSSL;
      }

      // add http(s) agent for axios requests to httpAgent or httpsAgent property as mentioned
      //  in this issue: https://github.com/axios/axios/issues/2072
      if (protocol === 'https:') {
        options.httpsAgent = new HttpsProxyAgent(agentOptions);
      } else {
        options.httpAgent = new HttpProxyAgent(agentOptions);
      }
    } else if (typeof options.strictSSL !== 'undefined' && protocol === 'https:') {
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: options.strictSSL,
      });
    }

    await exponentialRetry(retryOptions, async () => {
        response = await axios(options);
        response.elapsedTime = new Date().getTime() - reqStart;
    });
    return response;
}

/**
 * Determines whether a given error qualifies to be retried. Retryable errors include
 * network errors and 5xx level errors.
 * @param {*} e Error to check.
 * @returns {boolean} True if the error should be retried, false otherwise.
 */
function isRetryableError(e) {
    if (e && e.isAxiosError) {
        const { response = {} } = e;
        const { status } = response;

        // only retry 5xx errors and errors that don't have a status code (which
        // indicates some kind of network or I/O error)
        if (status && (status < 500 || status > 599)) {
            return false;
        }
    }
    return true;
}

/**
 * Does any necessary work to update an existing options object with the results
 * of an HTTP response. For example, if the response contains a set-cookie header
 * then the cookies will be added to the options.
 *
 * @param {DirectBinaryUploadOptions} options Options to update.
 * @param {HttpResponse} response A response from an HTTP client request.
 */
function updateOptionsWithResponse(options, response) {
    const setCookie = response.getHeaders()['set-cookie'];

    if (setCookie && setCookie.length) {
        options.withCookies(cookie.parse(setCookie[0]));
    }
}

/**
 * Calculate the rate of an HTTP transfer, in bytes per second.
 * @param {number} elapsed The total amount of time, in milliseconds, that
 *  the transfer has taken so far.
 * @param {number} totalTransferred The total number of bytes that have
 *  transferred so far.
 * @returns {number} Transfer rate, in bytes per second. Note that the
 *  rate will be 0 if not enough time has elapsed to get an accurate
 *  measurement.
 */
function calculateRate(elapsed, totalTransferred) {
    if (elapsed > 1000) {
        const elapsedSeconds = Math.round(elapsed / 1000);
        return Math.round(totalTransferred / elapsedSeconds);
    }

    return 0;
}

/**
 * Builds proxy agent options based on upload options. Note that the method may return a falsy value, which
 * indicates that a proxy does not apply.
 * @param {DirectBinaryUploadOptions} directBinaryUploadOptions Options from which to retrieve information.
 * @returns {object} Options for either http-proxy-agent or https-proxy-agent.
 */
function getProxyAgentOptions(directBinaryUploadOptions) {
    const proxy = directBinaryUploadOptions.getHttpProxy();
    if (proxy) {
        const proxyOptions = proxy.getUrl();
        const user = proxy.getBasicAuthUser();
        const password = proxy.getBasicAuthPassword();
        if (user) {
            proxyOptions.auth = `${user}:${password}`;
        }
        return proxyOptions;
    }
    return false;
}

/**
 * Converts options provided in a DirectBinaryUploadOptions instance to a format
 * suitable to pass to the httptransfer module.
 * @param {object} options General upload object options.
 * @param {DirectBinaryUploadOptions} directBinaryUploadOptions Options to convert.
 */
function getHttpTransferOptions(options, directBinaryUploadOptions) {
    // the httptransfer module accepts a full fileUrl instead of a single
    // url with individual file names. if needed, convert the format with a
    // single url and individual file names to the fileUrl format.
    const convertedFiles = directBinaryUploadOptions.getUploadFiles().map((uploadFile) => {
        const uploadFileInstance = new UploadFile(options, directBinaryUploadOptions, uploadFile);
        const transferOptions = uploadFileInstance.toJSON();
        if (uploadFile.blob) {
            // ensure blob is passed through to transfer options
            transferOptions.blob = uploadFile.blob;
        }
        return transferOptions;
    });

    const transferOptions = {
        uploadFiles: convertedFiles,
        headers: directBinaryUploadOptions.getHeaders(),
        concurrent: directBinaryUploadOptions.isConcurrent(),
        maxConcurrent: directBinaryUploadOptions.getMaxConcurrent(),
    };

    // assemble http(s) agent options, which can contain entries for proxy,
    //  strictSSL/rejectUnauthorized, or both
    const { protocol = 'http:' } = URL.parse(directBinaryUploadOptions.getUrl());
    const proxyOptions = getProxyAgentOptions(directBinaryUploadOptions);
    if (proxyOptions && proxyOptions.href) {
      const agentOptions = {};

      // TODO: figure out how to assemble proxy url
      agentOptions.proxy = proxyOptions.href;

      if (typeof options.strictSSL !== 'undefined') {
        agentOptions.rejectUnauthorized = options.strictSSL;
      }

      transferOptions.requestOptions = {
        agent: protocol === 'https:' ? new HttpsProxyAgent(agentOptions) : new HttpProxyAgent(agentOptions)
      };
    } else if (typeof options.strictSSL !== 'undefined' && protocol === 'https:') {
      transferOptions.requestOptions = {
        agent: new https.Agent({
          rejectUnauthorized: options.strictSSL,
        })
      };
    }

    return transferOptions;
}

export {
    createCancelToken,
    timedRequest,
    isRetryableError,
    updateOptionsWithResponse,
    calculateRate,
    getProxyAgentOptions,
    getHttpTransferOptions,
};
