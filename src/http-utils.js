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

import UploadError from './upload-error';
import { exponentialRetry } from './utils';

/**
 * Retrieves a token that can be used to cancel an http request.
 *
 * @returns {Object} Used to cancel an HTTP request.
 */
export function createCancelToken() {
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
export async function timedRequest(requestOptions, retryOptions, cancelToken) {
    const reqStart = new Date().getTime();
    const options = { ...requestOptions };

    if (options.onRetryError) {
        delete options.onRetryError;
    }

    if (cancelToken) {
        options.cancelToken = cancelToken.token;
    }

    let response;

    try {
        await exponentialRetry(retryOptions, async () => {
            response = await axios(options);
            response.elapsedTime = new Date().getTime() - reqStart;
        });
        return response;
    } catch (e) {
        throw UploadError.fromError(e);
    }
}

/**
 * Does any necessary work to update an existing options object with the results
 * of an HTTP response. For example, if the response contains a set-cookie header
 * then the cookies will be added to the options.
 *
 * @param {DirectBinaryUploadOptions} options Options to update.
 * @param {object} response A response object from an HTTP request.
 * @returns {DirectBinaryUploadOptions} Options with updated values.
 */
export function updateOptionsWithResponse(options, response) {
    const { headers = {} } = response;
    const setCookie = headers['set-cookie'];

    if (setCookie && setCookie.length) {
        return options.withCookies(cookie.parse(setCookie[0]));
    }

    return options;
}
