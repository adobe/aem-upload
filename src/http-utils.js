/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/

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
