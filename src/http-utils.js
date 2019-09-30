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

import UploadError from './upload-error';

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
 *
 * @param {object} requestOptions Will be passed as-is to the underlying HTTP request processor, axios.
 * @param {Object} [cancelToken] If specified, can be used to cancel the request.
 * @returns {object} The response to the request, which will match the signature of an axios response. In addition
 *  to typical axios response data, the object will also have an "elapsedTime" property containing the amount
 *  of time (in milliseconds) it took for the request to complete.
 */
export async function timedRequest(requestOptions, cancelToken) {
    const reqStart = new Date().getTime();
    const options = { ...requestOptions };

    if (cancelToken) {
        options.cancelToken = cancelToken.token;
    }

    try {
        const response = await axios(options);
        response.elapsedTime = new Date().getTime() - reqStart;
        return response;
    } catch (e) {
        throw UploadError.fromError(e);
    }
}
