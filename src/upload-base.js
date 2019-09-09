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

/**
 * Base class providing common functionality for an upload based on options
 * provided to a direct binary access-related instance.
 */
export default class UploadBase {
    /**
     * Initializes a new upload instance with the given options.
     *
     * @param {object} [options] Options controlling the upload.
     * @param {Object} [options.log] The object to use for logging messages during the upload process. If
     *  specified, the object should contain methods info(), warn(), debug(), and error(). Log information
     *  will be passed as parameters to these methods.
     */
    constructor(options = {}) {
        this.options = options;
        this.log = options.log;
    }

    /**
     * Retrieves the options as passed to the upload process instance.
     *
     * @returns {object} Raw options.
     */
    getOptions() {
        return this.options;
    }

    /**
     * Uses the info() method of the provided logger to log information about the upload.
     */
    logInfo(...theArguments) {
        if (this.log) {
            this.log.info.apply(this.log, theArguments);
        }
    }

    /**
     * Uses the warn() method of the provided logger to log information about the upload.
     */
    logWarn(...theArguments) {
        if (this.log) {
            this.log.warn.apply(this.log, theArguments);
        }
    }

    /**
     * Uses the debug() method of the provided logger to log information about the upload.
     */
    logDebug(...theArguments) {
        if (this.log) {
            this.log.debug.apply(this.log, theArguments);
        }
    }

    /**
     * Uses the error() method of the provided logger to log information about the upload.
     */
    logError(...theArguments) {
        if (this.log) {
            this.log.error.apply(this.log, theArguments);
        }
    }
}