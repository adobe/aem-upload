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

import UploadError from './upload-error';

import HttpResult from './http-result';

/**
 * Represents the results of an individual file part upload. These results contain information such as
 * the amount of time it took to transfer, and any error that may have occurred.
 */
export default class PartUploadResult extends HttpResult {
    /**
     * Constructs a new instance using the provided information. Can then be used to provide additional details
     * as needed.
     *
     * @param {object} options Options as provided when the upload instance was instantiated.
     * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the upload was initiated.
     * @param {InitResponseFilePart} filePart The part on which the results are based.
     */
    constructor(options, uploadOptions, filePart) {
        super(options, uploadOptions);

        this.filePart = filePart;
        this.elapsedTime = 0;
    }

    /**
     * Retrieves the byte offset, inclusive, of where in the file this part begins.
     *
     * @returns {number} A file byte offset.
     */
    getStartOffset() {
        return this.filePart.getStartOffset();
    }

    /**
     * Retrieves the byte offset, exclusive, of where in the file this part ends.
     *
     * @returns {number} A file byte offset.
     */
    getEndOffset() {
        return this.filePart.getEndOffset();
    }

    /**
     * Retrieves the URL to which this file part was uploaded.
     *
     * @returns {string} A URL.
     */
    getUrl() {
        return this.filePart.getUrl();
    }

    /**
     * Retrieves the amount of time, in milliseconds, it took for the part to upload.
     *
     * @returns {number} Time span in milliseconds.
     */
    getUploadTime() {
        return this.elapsedTime;
    }

    /**
     * Sets the amount of time, in milliseconds, it took for the part to upload.
     *
     * @param {number} elapsedTime Time span in milliseconds.
     */
    setUploadTime(elapsedTime) {
        this.elapsedTime = elapsedTime;
    }

    /**
     * Retrieves a value indicating whether or not the part uploaded successfully.
     *
     * @returns {boolean} TRUE if the upload succeeded, FALSE otherwise.
     */
    isSuccessful() {
        return !this.getError();
    }

    /**
     * Sets the error that occurred while the part was uploading.
     *
     * @param {*} error Error object, which will be wrapped in an UploadError instance.
     */
    setError(error) {
        this.error = UploadError.fromError(error, `unable to upload '${this.filePart.getFileName()}' part ${this.getStartOffset()}-${this.getEndOffset()} to signed URL`);
    }

    /**
     * Retrieves the error that occurred during the transfer. Will be falsy if there was no error.
     *
     * @returns {UploadError} Error information.
     */
    getError() {
        return this.error;
    }

    /**
     * Converts the result instance into a simple object containing all result data.
     *
     * @returns {object} Result data in a simple format.
     */
    toJSON() {
        return {
            start: this.getStartOffset(),
            end: this.getEndOffset(),
            message: this.getError() ? this.getError().getMessage() : '',
            elapsedTime: this.getUploadTime(),
            ...super.toJSON(),
        };
    }
}
