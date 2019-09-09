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

import axios from 'axios';

import UploadError from './upload-error';

/**
 * Submits an HTTP requests and provides the amount of time it took (in milliseconds) for the request to complete.
 *
 * @param {object} requestOptions Will be passed as-is to the underlying HTTP request processor, axios.
 * @returns {object} The response to the request, which will match the signature of an axios response. In addition
 *  to typical axios response data, the object will also have an "elapsedTime" property containing the amount
 *  of time (in milliseconds) it took for the request to complete.
 */
export async function timedRequest(requestOptions) {
    const reqStart = new Date().getTime();

    try {
        const response = await axios(requestOptions);
        response.elapsedTime = new Date().getTime() - reqStart;
        return response;
    } catch (e) {
        throw UploadError.fromError(e);
    }
}
