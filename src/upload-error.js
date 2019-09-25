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

import errorCodes from './error-codes';

/**
 * Concatenates to message values together if both are provided.
 *
 * @param {string} overallMessage Will be prepended to specificMessage, delimited with a colon, if supplied.
 * @param {string} specificMessage Will be concatenated with overallMessage, if supplied. Otherwise the return value of
 *  the method will be specificMessage as-is.
 * @returns {string} A message value.
 */
function getFullMessage(overallMessage, specificMessage) {
    if (overallMessage) {
        return `${overallMessage}: ${specificMessage}`;
    }
    return specificMessage;
}

/**
 * Custom Error class containing additional information specific to the upload process. This primarily consists of an
 * error code, which can be used by consumers to provide more specific information about the nature of an error.
 */
export default class UploadError extends Error {
    /**
     * Constructs a new UploadError instance out of a given error message. The method will attempt to create the
     * most specific type of error it can based on what it receives.
     *
     * @param {*} error Object from which to create the UploadError instance. Can be several things, including an
     *  UploadError instance, an error as thrown by axios, a string, or another Error instance.
     * @param {string} errorMessage Will appear in the error's "message" value.
     * @returns {UploadError} An upload error instance.
     */
    static fromError(error, errorMessage = '') {
        const {
            message,
            code,
            uploadError,
            response,
            stack,
        } = error;

        if (uploadError) {
            return error;
        }

        if (response) {
            const { status } = response;

            let code = errorCodes.UNKNOWN;
            if (status === 409) {
                code = errorCodes.ALREADY_EXISTS
            } else if (status === 403) {
                code = errorCodes.FORBIDDEN;
            } else if (status === 400) {
                code = errorCodes.INVALID_OPTIONS;
            } else if (status === 401) {
                code = errorCodes.NOT_AUTHORIZED;
            } else if (status === 404) {
                code = errorCodes.NOT_FOUND;
            } else if (status === 503) {
                code = errorCodes.NOT_SUPPORTED;
            }
            return new UploadError(`Request failed with status code ${status}`, code, stack);
        }

        if (message && code) {
            return new UploadError(getFullMessage(errorMessage, message), code, stack);
        }

        if (message) {
            return new UploadError(getFullMessage(errorMessage, message), errorCodes.UNKNOWN, stack);
        }

        if (typeof error === 'string') {
            return new UploadError(getFullMessage(errorMessage, error), errorCodes.UNKNOWN);
        }

        try {
            return new UploadError(getFullMessage(errorMessage, JSON.stringify(error)), errorCodes.UNKNOWN, stack);
        } catch (e) {
            return new UploadError(getFullMessage(errorMessage, error), errorCodes.UNKNOWN, stack);
        }
    }

    /**
     * Constructs a new instance containing the provided information.
     *
     * @param {string} message The message that will appear with the Error instance.
     * @param {string} code The code indicating the specific type of error.
     * @param {string} [innerStack] Additional stack information if the UploadError instance originated
     *  from another Error.
     */
    constructor(message, code, innerStack = '') {
        super(message);
        this.code = code;
        this.innerStack = innerStack;
        this.uploadError = true;
    }

    /**
     * Retrieves the error code representing the specific type of error. See ErrorCodes for more
     * information.
     *
     * @returns {string} An error code value.
     */
    getCode() {
        return this.code;
    }

    /**
     * Retrieves the upload error's status as an HTTP status code.
     *
     * @returns {number} An HTTP status code.
     */
    getHttpStatusCode() {
        const code = this.getCode();

        if (code === errorCodes.ALREADY_EXISTS) {
            return 409;
        } else if (code === errorCodes.FORBIDDEN) {
            return 403;
        } else if (code === errorCodes.INVALID_OPTIONS) {
            return 400;
        } else if (code === errorCodes.NOT_AUTHORIZED) {
            return 401;
        } else if (code === errorCodes.NOT_FOUND) {
            return 404;
        } else if (code === errorCodes.NOT_SUPPORTED) {
            return 503;
        } else {
            return 500;
        }
    }

    /**
     * Retrieves a message describing the error.
     *
     * @returns {string} The error's message.
     */
    getMessage() {
        return this.message;
    }

    /**
     * Retrieves the inner stack of the error, as provided to the constructor.
     *
     * @returns {string} The error's inner stack.
     */
    getInnerStack() {
        return this.innerStack;
    }

    /**
     * Converts the error instance into a simplified object form.
     *
     * @returns {object} Simple object representation of the error.
     */
    toJSON() {
        const json = {
            message: this.message,
            code: this.code,
        };

        if (this.innerStack) {
            json.innerStack = this.innerStack;
        }

        return json;
    }

    /**
     * Converts the error to a string, which will be a stringified version of the error's toJSON() method.
     *
     * @returns {string} String representation of the error.
     */
    toString() {
        return JSON.stringify(this);
    }
}
