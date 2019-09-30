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

import { EventEmitter } from 'events';

/**
 * Base class providing common functionality for an upload based on options
 * provided to a direct binary access-related instance.
 */
export default class UploadBase extends EventEmitter {
    /**
     * Initializes a new upload instance with the given options.
     *
     * @param {object} [options] Options controlling the upload.
     * @param {Object} [options.log] The object to use for logging messages during the upload process. If
     *  specified, the object should contain methods info(), warn(), debug(), and error(). Log information
     *  will be passed as parameters to these methods.
     */
    constructor(options = {}) {
        super();
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

    /**
     * Sends an event to external consumers.
     *
     * @param {string} eventName The name of the event to send.
     * @param {object} eventData Will be included as the event's data.
     */
    sendEvent(eventName, eventData) {
        this.emit(eventName, eventData);
    }
}