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

import { timedRequest, createCancelToken, isRetryableError } from '../http-utils';
import ErrorCodes from '../error-codes';
import UploadOptionsBase from '../upload-options-base';
import UploadError from '../upload-error';
import HttpResponse from './http-response';
import { v4 as uuid } from 'uuid';

/**
 * Invoked when there is an immediate retry error. Handles special cases and adds the
 * error to the given result.
 * @param {Error|string} e The error that occurred.
 * @param {HttpResult} httpResult Result being provided for the current operation.
 */
function handleRetryError(e, httpResult) {
    if (e && e.message && e.message === ErrorCodes.USER_CANCELLED) {
        throw new UploadError('user cancelled the operation', ErrorCodes.USER_CANCELLED);
    }
    if (!isRetryableError(e)) {
        throw e;
    }
    if (httpResult) {
        httpResult.addRetryError(e);
    }
}

/**
 * Builds an object containing retry options that will be provided to the utility method
 * that submits HTTP requests. The options will include the number of times to retry,
 * the amount of time between retries, and a method to invoke whenever there is an
 * intermediate error.
 *
 * @param {DirectBinaryUploadOptions} uploadOptions Options controlling the upload process.
 * @param {HttpResult} httpResult Result being provided for the current operation. Any
 *   intermediate retry errors will be added to the result.
 */
function getRetryOptions(uploadOptions, httpResult) {
    return {
        retryCount: uploadOptions.getHttpRetryCount(),
        retryDelay: uploadOptions.getHttpRetryDelay(),
        onRetryError: e => handleRetryError(e, httpResult),
    }
}

/**
 * Registers a cancel token, which is used to cancel an HTTP request, with
 * a corresponding cancel ID.
 *
 * @param {string} cancelId ID that will be passed to cancel().
 * @param {string} tokenId A unique identifier that can be used to identify
 *  this specific token. Will be used to remove the token when the request
 *  is finished.
 * @param {*} cancelToken Axios token that is used to cancel an request.
 */
function registerCancelId(cancelId, tokenId, cancelToken) {
    if (!this.cancelTokens[cancelId]) {
        this.cancelTokens[cancelId] = [];
    }
    this.cancelTokens[cancelId].push(cancelToken);
}

/**
 * Removes a cancel token that was previously registered using registerCancelId.
 *
 * @param {string} cancelId ID that will be passed to cancel().
 * @param {string} tokenId A unique identifier that can be used to identify
 *  the specific token to remove.
 */
function unregisterCancelId(cancelId, tokenId) {
    if (this.cancelTokens[cancelId]) {
        for (let i = 0; i < this.cancelTokens[cancelId].length; i++) {
            const { tokenId: currTokenId } = this.cancelTokens[cancelId][i];

            if (tokenId === currTokenId) {
                this.cancelTokens[cancelId].splice(i, 1);
                break;
            }
        }
    }
}

/**
 * Cancels HTTP requests based on event data from DirectBinaryUploadController's
 * 'cancel' event data. Depending on event data, the client will either cancel
 * only those requests whose cancel ID matches the given file name, or cancel
 * all requests if no fileName is given.
 *
 * @param {object} cancelEventData Event data from cancel event.
 */
function cancelFromController(cancelEventData) {
    const { fileName: targetFilePath } = cancelEventData;

    if (targetFilePath) {
        // use the target file's path as cancel ID and cancel any matches
        this.cancel(targetFilePath);
    } else {
        // no file path, cancel ALL requests
        this.cancelAll();
    }
}

/**
 * Supports submitting and managing in-progress HTTP requests. Features of the
 * client include retrying failed requests, timing request duration, and canceling
 * in-progress requests.
 */
export default class HttpClient extends UploadOptionsBase {

    /**
     * Constructs a new instance of an HTTP request client using the given
     * information.
     * @param {object} options General direct binary upload options.
     * @param {DirectBinaryUploadOptions} uploadOptions Options specific to
     *  the current upload.
     */
    constructor(options, uploadOptions) {
        super(options, uploadOptions);
        this.cancelTokens = {};
        this.cancelledTokens = {};
        this.allCancelled = false;

        this.getUploadOptions().getController().on('cancel', cancelFromController.bind(this));
    }

    /**
     * Cancels one or more in-progress request(s) by a cancel ID.
     *
     * @param {string} cancelId All requests with a matching cancelId
     *  will be cancelled.
     */
    cancel(cancelId) {
        if (this.cancelTokens[cancelId]) {
            this.cancelTokens[cancelId].forEach(cancelToken => {
                cancelToken.cancel(ErrorCodes.USER_CANCELLED);
            });
            delete this.cancelTokens[cancelId];
        }
        this.cancelledTokens[cancelId] = true;
    }

    /**
     * Cancels all in-progress requests, regardless of cancel ID.
     */
    cancelAll() {
        Object.keys(this.cancelTokens).forEach(cancelId => {
            this.cancel(cancelId);
        });
        this.allCancelled = true;
    }

    /**
     * Retrieves a value indicating whether a given cancel ID has been
     * used to cancel an in-progress request. Will return true if the
     * individual ID was cancelled, or if all requests were cancelled.
     *
     * @param {string} cancelId ID to check for cancellation.
     * @returns {boolean} True if the ID was cancelled, false otherwise.
     */
    isCancelled(cancelId) {
        return this.allCancelled || !!this.cancelledTokens[cancelId];
    }

    /**
     * Submits an HTTP request. The client will automatically retry the request if
     * it encounters a retry-able error (i.e. 5xx errors or network-related errors).
     * If the request results in a non-success response then the method will throw an
     * exception containing details of the error.
     *
     * The client also provides support for canceling an in-progress request using
     * its cancel() method.
     *
     * Note that all errors that this method throws will be of type UploadError.
     *
     * @param {HttpRequest} httpRequest Request to submit. Information will be used to initialize
     *  an HTTP request. Note that, if present, the request's getCancelId() can be used with
     *  the cancel() method to cancel this request. In addition, the request will be cancelled
     *  if the ID matches the name of the file in DirectBinaryUploadController's "cancel" event.
     *  Note that the ID doesn't need to be unique to a request - meaning that multiple requests
     *  could be cancelled using a single cancelId.
     * @param {HttpResult} [httpResult] Optional result to which any retry errors will be
     *  added.
     * @returns {HttpResponse} Response to the request, which can be used to retrieve information
     *  from the response.
     */
    async submit(httpRequest, httpResult = false) {
        const cancelToken = createCancelToken();
        const tokenId = uuid();
        registerCancelId.call(this, httpRequest.getCancelId(), tokenId, cancelToken);

        try {
            const rawResponse = await timedRequest(
                httpRequest.toJSON(),
                getRetryOptions(this.getUploadOptions(), httpResult),
                cancelToken
            );
            return new HttpResponse(this.getOptions(), rawResponse);
        } catch (e) {
            const {
                isAxiosError,
                config = {},
                response = {}
            } = e || {};
            if (isAxiosError) {
                const { url, method } = config;
                const { status } = response;
                this.logError(`${method} ${url} < failed with status code ${status}`);
            } else {
                this.logError('HTTP request failed with error', e);
            }
            throw UploadError.fromError(e);
        } finally {
            unregisterCancelId.call(this, httpRequest.getCancelId(), tokenId);
        }
    }

}
