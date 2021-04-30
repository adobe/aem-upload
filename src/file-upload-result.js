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

import filesize from 'filesize';

import { getAverage } from './utils';
import { calculateRate } from './http-utils';
import UploadError from './upload-error';
import HttpResult from './http-result';

/**
 * Represents the results of an individual file upload. These results include information like
 * the amount of time the file took to upload, the number of parts in which the file was uploaded,
 * and any error information that may have occurred during the upload.
 */
export default class FileUploadResult extends HttpResult {
    /**
     * Constructs a new instance of the result, which can be used to provide result values.
     *
     * @param {object} options Options as provided when the upload instance was instantiated.
     * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the upload was initiated.
     * @param {InitResponseFileInfo} initResponseFileInfo File information on which the results are based.
     */
    constructor(options, uploadOptions, initResponseFileInfo) {
        super(options, uploadOptions);

        this.initResponseFileInfo = initResponseFileInfo;
        this.parts = [];
        this.cancelled = false;
    }

    /**
     * Starts a timer that will be used to determine the total duration of the file upload.
     */
    startTimer() {
        this.start = new Date().getTime();
    }

    /**
     * Retrieves the timestamp when the file started to transfer.
     * @returns {number} A timestamp.
     */
    getStartTime() {
        return this.start;
    }

    /**
     * Stops the timer and calculates the amount of time elapsed since startTimer() was called.
     */
    stopTimer() {
        if (this.start) {
            this.totalTime = new Date().getTime() - this.start;
        }
    }

    /**
     * Retrieves the name of the file that was uploaded, as provided in the upload options.
     *
     * @returns {string} The name of the file.
     */
    getFileName() {
        return this.initResponseFileInfo.getFileName();
    }

    /**
     * Retrieves the size of the file (in bytes) that was uploaded, as provided in the upload options.
     *
     * @returns {number} File size in bytes.
     */
    getFileSize() {
        return this.initResponseFileInfo.getFileSize();
    }

    /**
     * Adds an individual part upload result to the file's result. These will be used to compile additional statistics about the
     * upload.
     *
     * @param {PartUploadResult} partResult The new part result whose metrics will be incorporated in the file results.
     */
    addPartResult(partResult) {
        this.parts.push(partResult);
    }

    /**
     * Retrieves the number of parts in which the file was uploaded.
     *
     * @returns {number} Number of file part uploads.
     */
    getPartCount() {
        return this.parts.length;
    }

    /**
     * Retrieves the total amount of time, in milliseconds, that the file upload took. This is the amount of time
     * between when startTimer() and stopTimer() were called.
     *
     * @returns {number} A time span in milliseconds.
     */
    getTotalUploadTime() {
        return this.totalTime || 0;
    }

    /**
     * Directly sets the total amount of time it took, in milliseconds, for
     * the file to upload.
     *
     * @param {number} elapsedTime Time span in milliseconds.
     */
    setTotalUploadTime(elapsedTime) {
        this.totalTime = elapsedTime;
    }

    /**
     * Retrieves the transfer rate of the file, in bytes per second. Will return 0
     * if the file uploaded too quickly to get a meaningful rate.
     *
     * @returns {number} Bytes per second value.
     */
    getUploadRate() {
        return calculateRate(this.getTotalPartUploadTime(), this.getFileSize());
    }

    /**
     * Gets the total amount of time, in milliseconds, it took for all parts (only) to upload. This
     * will exclude the init and complete time.
     *
     * @returns {number} Timespan in milliseconds.
     */
    getTotalPartUploadTime() {
        return this.parts.reduce((a, b) => a + b, 0);
    }

    /**
     * Retrieves the amount of time, in milliseconds, that it took the part that completed the fastest to transfer.
     *
     * @returns {number} A time span in milliseconds.
     */
    getFastestPartUploadTime() {
        return Math.min(...this.parts.map(part => part.getUploadTime()));
    }

    /**
     * Retrieves the amount of time, in milliseconds, that it took the part that completed the slowest to transfer.
     *
     * @returns {number} A time span in milliseconds.
     */
    getSlowestPartUploadTime() {
        return Math.max(...this.parts.map(part => part.getUploadTime()));
    }

    /**
     * The average amount of time, in milliseconds, that it took for parts to transfer.
     *
     * @returns {number} A time span in milliseconds.
     */
    getAveragePartUploadTime() {
        return getAverage(this.parts.map(part => part.getUploadTime()));
    }

    /**
     * The amount of time, in milliseconds, that it took for the file's complete call to finish.
     *
     * @returns {number} A time span in milliseconds.
     */
    getTotalCompleteTime() {
        return this.completeTime || 0;
    }

    /**
     * Sets the amount of time, in milliseconds, that it took for the file's complete call to finish.
     *
     * @param {number} completeTime A time span in milliseconds.
     */
    setTotalCompleteTime(completeTime) {
        this.completeTime = completeTime;
    }

    /**
     * Retrieves a value indicating whether or not the file transferred successfully.
     *
     * @returns {boolean} TRUE if the transfer succeeded, false otherwise.
     */
    isSuccessful() {
        return !this.getErrors().length && !this.isCancelled();
    }

    /**
     * Retrieves any errors that may have occurred during the file transfer. There may be multiple errors
     * if multiple parts failed to transfer.
     *
     * @returns {Array} An array of UploadError instances representing errors that happend while transferring.
     */
    getErrors() {
        const errors = [];

        if (this.error) {
            errors.push(this.error);
        }

        this.parts.forEach(part => {
            if (!part.isSuccessful()) {
                errors.push(part.getError());
            }
        });
        return errors;
    }

    /**
     * Sets the error message that occurred when attempting to complete the upload for the file.
     *
     * @param {*} error Error object, which will be wrapped in an UploadError instance.
     */
    setCompleteError(error) {
        this.error = UploadError.fromError(error, `unable to complete upload for file ${this.getFileName()}`);
    }

    /**
     * Retrieves all the part results that make up the total file upload result.
     *
     * @returns {Array} List of PartUploadResult instances.
     */
    getPartUploadResults() {
        return this.parts;
    }

    /**
     * Retrieves a value indicating whether or not the file upload was cancelled.
     *
     * @returns {boolean} True if the file upload was cancelled, false otherwise.
     */
    isCancelled() {
        return this.cancelled;
    }

    /**
     * Sets whether or not the file upload was cancelled.
     *
     * @param {boolean} cancelled Value indicating whether transfer was cancelled.
     */
    setIsCancelled(cancelled) {
        this.cancelled = cancelled;
    }

    /**
     * Converts the result instance into a simple object containing all result data.
     *
     * @returns {object} Result data in a simple format.
     */
    toJSON() {
        const partSize = this.initResponseFileInfo.getFilePartSize();

        let message = '';

        this.getErrors().forEach(error => {
            if (message) {
                message += '\n';
            }
            message += error.getMessage();
        });

        const data = {
            fileName: this.initResponseFileInfo.getFileName(),
            targetPath: this.initResponseFileInfo.getTargetFilePath(),
            fileSize: this.initResponseFileInfo.getFileSize(),
            partSize,
            fileSizeStr: filesize(this.initResponseFileInfo.getFileSize()),
            partSizeStr: filesize(partSize),
            partNum: this.getPartCount(),
            putSpentFinal: this.getTotalUploadTime(),
            putSpentMin: this.getFastestPartUploadTime(),
            putSpentMax: this.getSlowestPartUploadTime(),
            putSpentAvg: this.getAveragePartUploadTime(),
            completeSpent: this.getTotalCompleteTime(),
            success: this.isSuccessful(),
            message,
            partDetails: this.parts.map(part => part.toJSON()),
            ...super.toJSON(),
        };

        if (this.isCancelled()) {
            data.cancelled = true;
        }

        const createVersion = this.initResponseFileInfo.shouldCreateNewVersion();
        const versionLabel = this.initResponseFileInfo.getVersionLabel();
        const versionComment = this.initResponseFileInfo.getVersionComment();
        const shouldReplace = this.initResponseFileInfo.shouldReplace();
        if (createVersion) {
            data.createVersion = createVersion;
        }

        if (versionLabel) {
            data.versionLabel = versionLabel;
        }

        if (versionComment) {
            data.versionComment = versionComment;
        }

        if (shouldReplace) {
            data.replace = shouldReplace;
        }

        return data;
    }
}
