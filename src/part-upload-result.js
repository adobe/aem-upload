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

import UploadError from './upload-error';

/**
 * Represents the results of an individual file part upload. These results contain information such as
 * the amount of time it took to transfer, and any error that may have occurred.
 */
export default class PartUploadResult {
    /**
     * Constructs a new instance using the provided information. Can then be used to provide additional details
     * as needed.
     *
     * @param {InitResponseFilePart} filePart The part on which the results are based.
     * @param {number} elapsedTime The amount of time, in milliseconds, it took the part to upload.
     */
    constructor(filePart, elapsedTime) {
        this.filePart = filePart;
        this.elapsedTime = elapsedTime;
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
        this.error = UploadError.fromError(error, `unable to upload '${this.filePart.getFileName()}' part ${this.getStartOffset()}-${this.getEndOffset()} to ${this.getUrl()}`);
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
            url: this.getUrl(),
            message: this.getError() ? this.getError().getMessage() : '',
            elapsedTime: this.getUploadTime(),
        };
    }
}
