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

import querystring from 'querystring';

import UploadOptionsBase from './upload-options-base';
import InitResponse from './init-response';
import UploadFile from './upload-file';
import UploadResult from './upload-result';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';
import FileUploadResult from './file-upload-result';
import PartUploadResult from './part-upload-result';
import { timedRequest, createCancelToken } from './http-utils';
import {
    concurrentLoop,
    serialLoop,
} from './utils';

const DEFAULT_PROGRESS_THRESHOLD = 500;

/**
 * Contains all logic for the process that uploads a set of files using direct binary access.
 */
export default class DirectBinaryUploadProcess extends UploadOptionsBase {
    constructor(options, uploadOptions) {
        super(options, uploadOptions);

        this.cancelled = false;
        this.cancelledFiles = {};
        this.cancelTokens = {};
        this.initCancelToken = null;
        this.fileResults = {};
        this.fileEvents = {};
        this.fileTransfer = {};
    }

    /**
     * Does the work of uploading all files based on the upload options provided to the process.
     *
     * @returns {Promise} Resolved with an UploadResult instance when the process has finished.
     */
    async upload() {
        const options = this.getUploadOptions();
        const url = options.getUrl();
        const targetFolder = options.getTargetFolderPath();
        const toUpload = options.getUploadFiles().map(upload => new UploadFile(this.getOptions(), options, upload));
        const headers = options.getHeaders();
        const concurrent = options.isConcurrent();

        const uploadResult = new UploadResult(this.getOptions(), options);
        uploadResult.startTimer();

        const initOptions = {
            url: `${url}.initiateUpload.json`,
            method: 'POST',
            headers: {
                ...headers,
                'content-type': 'application/x-www-form-urlencoded',
            },
            data: querystring.stringify({
                path: targetFolder,
                fileName: toUpload.map(file => file.getFileName()),
                fileSize: toUpload.map(file => file.getFileSize()),
            }),
            responseType: 'json',
        };

        let initResponse;
        let fileListInit;

        try {
            this.initCancelToken = createCancelToken();
            const response = await timedRequest(initOptions, this.getRetryOptions(options, uploadResult), this.initCancelToken);
            this.initCancelToken = null;
            const {
                data: resObj,
                status: statusCode,
                elapsedTime = 0,
            } = response;

            this.logInfo(`Finished initialize uploading, response code: '${statusCode}', time elapsed: '${elapsedTime}' ms`);

            this.logInfo('Init upload result: ' + JSON.stringify(resObj, null, 4));

            initResponse = new InitResponse(this.getOptions(), options, toUpload, resObj);
            fileListInit = initResponse.getFiles();

            if (!fileListInit.length || !fileListInit[0].getUploadUris().length) {
                throw new UploadError('direct binary access not supported', ErrorCodes.NOT_SUPPORTED);
            }

            uploadResult.setInitTime(elapsedTime);
            uploadResult.setTotalFiles(fileListInit.length);
        } catch (e) {
            throw UploadError.fromError(e, 'unable to initiate upload');
        }

        const controller = options.getController();

        controller.on('cancel', data => {
            this.cancel(data);
        });

        const allParts = initResponse.getAllParts();
        if (concurrent) {
            this.logInfo(`Concurrently uploading ${allParts.length} total parts with a max count of ${options.getMaxConcurrent()}`);
            await concurrentLoop(
                allParts,
                options.getMaxConcurrent(),
                (part) => this.processPart(options, uploadResult, initResponse, part));
        } else {
            this.logInfo(`Serially uploading ${allParts.length} total parts`);
            await serialLoop(allParts, (part) => this.processPart(options, uploadResult, initResponse, part));
        }

        uploadResult.stopTimer();

        // output json result to logger
        this.logInfo('Uploading result in JSON: ' + JSON.stringify(uploadResult, null, 4));

        return uploadResult;
    }

    /**
     * If needed, starts a file's upload by initializing an upload result and sending
     * events.
     *
     * @param {DirectBinaryUploadOptions} uploadOptions The upload process's options.
     * @param {InitResponseFileInfo} initResponseFileInfo File information to be used.
     * @param {UploadResult} uploadResult Overall result to which file's result will be added.
     * @returns {FileUploadResult} The file's upload result information.
     */
    startFileUpload(uploadOptions, initResponseFileInfo, uploadResult) {
        const resultKey = initResponseFileInfo.getFileName();
        if (!this.fileResults[resultKey]) {
            this.fileResults[resultKey] = new FileUploadResult(this.getOptions, uploadOptions, initResponseFileInfo);
            this.fileResults[resultKey].startTimer();
            this.fileEvents[resultKey] = {};
            this.fileTransfer[resultKey] = 0;

            uploadResult.addFileUploadResult(this.fileResults[resultKey]);

            if (!this.isCancelled(initResponseFileInfo)) {
                this.sendEvent('filestart', initResponseFileInfo.getFileEventData());
            }
        }
        return this.fileResults[resultKey];
    }

    /**
     * Checks if all parts of a file have uploaded and, if so, stops the result timer
     * and removes the in-progress file data.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Information to use to determine if all parts are finished.
     * @param {FileUploadResult} fileUploadResult Result whose current part count will be
     *  compared with total part count.
     * @returns True if the file is finished, false otherwise.
     */
    stopFileUpload(initResponseFileInfo, fileUploadResult) {
        if (initResponseFileInfo.getFilePartCount() === fileUploadResult.getPartCount()) {
            const resultKey = initResponseFileInfo.getFileName();
            const fileUploadResult = this.fileResults[resultKey];
            fileUploadResult.stopTimer();

            this.logInfo(`Finished uploading '${initResponseFileInfo.getFileName()}', took '${fileUploadResult.getTotalUploadTime()}' ms`);

            delete this.fileResults[resultKey];

            return true;
        }
        return false;
    }

    /**
     * Does the work of uploading a single part to its target URL.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the method behaves.
     * @param {UploadResult} uploadResult Results for the overall upload.
     * @param {InitResponse} initResponse The response data from the init request.
     * @param {InitResponseFilePart} initResponseFilePart Initialization info about the part currently being processed.
     */
    async processPart(options, uploadResult, initResponse, initResponseFilePart) {
        const fileName = initResponseFilePart.getFileName();
        const fileSize = initResponseFilePart.getFileSize();

        const eventData = initResponseFilePart.getFileEventData();
        const fileUploadResult = this.startFileUpload(options, initResponseFilePart, uploadResult);

        if (fileUploadResult.isSuccessful() && !this.isCancelled(initResponseFilePart)) {
            this.logInfo(`Start uploading '${fileName}' to cloud, fileSize: '${fileSize}'`);

            await this.uploadPartToCloud(options, fileUploadResult, initResponseFilePart);

            if (this.stopFileUpload(initResponseFilePart, fileUploadResult) && fileUploadResult.isSuccessful() && !this.isCancelled(initResponseFilePart)) {
                try {
                    await this.completeUpload(options, initResponse, initResponseFilePart, fileUploadResult);
                } catch (e) {
                    fileUploadResult.setCompleteError(e);
                    this.logError(`Complete uploading error '${fileName}'`, e);
                }

                if (fileUploadResult.isSuccessful()) {
                    this.sendEvent('fileend', eventData);
                }
            }
        }

        if (this.isCancelled(initResponseFilePart)) {
            fileUploadResult.setIsCancelled(true);
            this.sendEventOnce(initResponseFilePart, 'filecancelled', eventData);
        } else if (!fileUploadResult.isSuccessful()) {
            this.sendEventOnce(initResponseFilePart, 'fileerror', {
                ...eventData,
                errors: fileUploadResult.getErrors(),
            });
        }
    }

    /**
     * Does the work of completing an upload by submitting a request to the complete upload servlet.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the method behaves.
     * @param {InitResponse} initResponse Data from the initiate request.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve the file's
     *  information.
     * @param {FileUploadResult} fileUploadResult Information about the complete request will
     *  be added to the result.
     */
    async completeUpload(options, initResponse, initResponseFileInfo, fileUploadResult) {
        const headers = options.getHeaders();
        const fileName = initResponseFileInfo.getFileName();
        const fileSize = initResponseFileInfo.getFileSize();
        const mimeType = initResponseFileInfo.getMimeType();
        const uploadToken = initResponseFileInfo.getUploadToken();

        const completeData = {
            fileName,
            mimeType,
            uploadToken,
            uploadDuration: fileUploadResult.getTotalUploadTime(),
            fileSize,
        };

        if (initResponseFileInfo.shouldCreateNewVersion()) {
            completeData.createVersion = true;

            const versionLabel = initResponseFileInfo.getVersionLabel();
            const versionComment = initResponseFileInfo.getVersionComment();
            if (versionLabel) {
                completeData.versionLabel = versionLabel;
            }
            if (versionComment) {
                completeData.versionComment = versionComment;
            }
        } else if (initResponseFileInfo.shouldReplace()) {
            completeData.replace = true;
        }

        const completeOptions = {
            url: initResponse.getCompleteUri(),
            method: 'POST',
            headers: {
                ...headers,
                'content-type': 'application/x-www-form-urlencoded',
            },
            data: querystring.stringify(completeData),
        };

        const cancelToken = this.addCancelToken(fileName, 'complete');
        const response = await timedRequest(completeOptions, this.getRetryOptions(options, fileUploadResult), cancelToken);
        this.removeCancelToken(fileName, 'complete');
        const {
            elapsedTime: completeElapsedTime = 0,
            status: completeStatusCode,
        } = response;
        fileUploadResult.setTotalCompleteTime(completeElapsedTime);

        this.logInfo(`Finished complete uploading '${fileName}', response code: '${completeStatusCode}', time elapsed: '${completeElapsedTime}' ms`);
    }

    /**
     * Retrieves the last time an event was sent for a particular file.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve file information.
     * @param {string} eventName The name of the event.
     * @returns {number} Last time an event was sent, in milliseconds. Returns 0 if the event hasn't
     *  been sent for the given file.
     */
    getLastEventTime(initResponseFileInfo, eventName) {
        const eventKey = initResponseFileInfo.getFileName();
        if (this.fileEvents[eventKey][eventName]) {
            return this.fileEvents[eventKey][eventName];
        }

        return 0;
    }

    /**
     * Uses the current time to set the last time an event was sent for a particular file.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Will be used to retrieve file information.
     * @param {string} eventName The name of the event.
     */
    setLastEventTime(initResponseFileInfo, eventName) {
        const eventKey = initResponseFileInfo.getFileName();
        this.fileEvents[eventKey][eventName] = new Date().getTime();
    }

    /**
     * Sends an event for a given file if it hasn't been sent already.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Will be used to retrieve file information.
     * @param {string} eventName The name of the event to send.
     * @param {object} eventData Data to provide with the event.
     */
    sendEventOnce(initResponseFileInfo, eventName, eventData) {
        if (!this.getLastEventTime(initResponseFileInfo, eventName)) {
            this.setLastEventTime(initResponseFileInfo, eventName);

            this.sendEvent(eventName, eventData);
        }
    }

    /**
     * Sends an event for a given file, but only if the event hasn't been sent for a specified interval.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Will be used to retrieve file information.
     * @param {string} eventName The name of the event to send.
     * @param {object} eventData Data to provide with the event.
     */
    sendMeteredEvent(initResponseFileInfo, eventName, eventData) {
        const currTime = new Date().getTime();
        const { progressDelay = DEFAULT_PROGRESS_THRESHOLD } = this.getOptions();

        if (currTime - this.getLastEventTime(initResponseFileInfo, eventName) > progressDelay) {
            this.setLastEventTime(initResponseFileInfo, eventName);

            this.sendEvent(eventName, eventData);
        }
    }

    /**
     * Sends a progress event for a given file, but only if it hasn't been sent for a specified interval.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo Will be used to retrieve file information.
     * @param {number} transferred The amount of data, in bytes, that has transferred. Will be added to a
     *  running total for the file.
     */
    sendProgressEvent(initResponseFileInfo, transferred) {
        const transferKey = initResponseFileInfo.getFileName();
        this.fileTransfer[transferKey] += transferred;
        this.sendMeteredEvent(initResponseFileInfo, 'fileprogress', {
            ...initResponseFileInfo.getFileEventData(),
            transferred: this.fileTransfer[transferKey]
        });
    }

    /**
     * Performs the work of uploading a single file part to the target instance.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the overall upload behaves.
     * @param {FileUploadResult} fileUploadResult Information about the upload process of the individual file will be added
     *  to this result.
     * @param {InitResponseFilePart} part The file part whose information will be used to do the upload.
     */
    async uploadPartToCloud(options, fileUploadResult, part) {
        const data = part.getData();
        const reqOptions = {
            url: part.getUrl(),
            method: 'PUT',
            data,
        };

        let totalTransferred = 0;
        if (data.on) {
            data.on('data', chunk => {
                this.sendProgressEvent(part, chunk.length);
            });
        } else {
            reqOptions.onUploadProgress = progress => {
                const { loaded } = progress;
                if (loaded) {
                    let incLoaded = loaded - totalTransferred;
                    totalTransferred = loaded;
                    this.sendProgressEvent(part, incLoaded);
                }
            };
        }

        if (options.addContentLengthHeader()) {
            reqOptions.headers = {
                'content-length': part.getSize(),
            };
        }

        const partResult = new PartUploadResult(this.getOptions(), options, part);
        try {
            const tokenName = `part_${part.getStartOffset()}`;
            const cancelToken = this.addCancelToken(part.getFileName(), tokenName);
            const response = await timedRequest(reqOptions, this.getRetryOptions(options, partResult), cancelToken);
            this.removeCancelToken(part.getFileName(), tokenName);

            const {
                status: statusCode,
                elapsedTime = 0,
            } = response;

            this.logInfo(`Put upload part done for file: '${part.getFileName()}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}', spent: '${elapsedTime}' ms, status: ${statusCode}`);
            partResult.setUploadTime(elapsedTime);
            fileUploadResult.addPartResult(partResult);
        } catch (e) {
            partResult.setError(e);
            fileUploadResult.addPartResult(partResult);
            this.logError(`Put upload part done for file: '${part.getFileName()}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}'`, e);
        }
    }

    /**
     * Cancels either a specific file, or the upload process as a whole, depending on the provided options.
     *
     * @param {object} options Controls what is cancelled.
     * @param {string} [options.fileName] If provided, the name of the file whose upload should be cancelled. If not
     *   provided, cancels the entire upload process.
     */
    cancel(options) {
        const { fileName } = options;

        if (fileName) {
            this.cancelledFiles[fileName] = true;
            this.cancelAllFileTokens(fileName);
        } else {
            this.cancelled = true;
        }
    }

    /**
     * Retrieves a value indicating whether or not a given file transfer has been cancelled.
     *
     * @param {InitResponseFileInfo} initResponseFileInfo The file being uploaded.
     */
    isCancelled(initResponseFileInfo) {
        return this.cancelled || !!this.cancelledFiles[initResponseFileInfo.getFileName()];
    }

    /**
     * Creates and registers a cancel token with the process. This can be used to cancel requests for a file, if needed.
     *
     * @param {string} fileName Name of the file to which the token belongs.
     * @param {string} tokenName Name of the token to register. Should be unique to the fileName.
     * @returns {Object} Can be used to cancel an HTTP request.
     */
    addCancelToken(fileName, tokenName) {
        const token = createCancelToken();

        if (!this.cancelTokens[fileName]) {
            this.cancelTokens[fileName] = {};
        }
        this.cancelTokens[fileName][tokenName] = token;

        return token;
    }

    /**
     * Unregisters a cancel token with the process.
     *
     * @param {string} fileName Name of the file to which the token belongs.
     * @param {string} tokenName Name of the token to unregister.
     */
    removeCancelToken(fileName, tokenName) {
        if (this.cancelTokens[fileName]) {
            if (this.cancelTokens[fileName][tokenName]) {
                delete this.cancelTokens[fileName][tokenName];
            }
        }
    }

    /**
     * Iterates over all tokens registered for a file and cancels each. Also clears all tokens for the file.
     *
     * @param {string} fileName Name of the file whose tokens should be canceled.
     */
    cancelAllFileTokens(fileName) {
        if (this.cancelTokens[fileName]) {
            Object.keys(this.cancelTokens[fileName]).forEach(tokenName => {
                this.cancelTokens[fileName][tokenName].cancel(ErrorCodes.USER_CANCELLED);
            });
            this.cancelTokens[fileName] = {};
        }
    }

    /**
     * Iterates over all tokens registered for all files and cancels each. Also clears the tokens.
     */
    cancelAllTokens() {
        if (this.initCancelToken) {
            this.initCancelToken.cancel(ErrorCodes.USER_CANCELLED);
            this.initCancelToken = null;
        }
        Object.keys(this.cancelTokens).forEach(fileName => this.cancelAllFileTokens(fileName));
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
    getRetryOptions(uploadOptions, httpResult) {
        return {
            retryCount: uploadOptions.getHttpRetryCount(),
            retryDelay: uploadOptions.getHttpRetryDelay(),
            onRetryError: e => this.handleRetryError(e, httpResult),
        }
    }

    /**
     * Invoked when there is an immediate retry error. Handles special cases and adds the
     * error to the given result.
     * @param {Error|string} e The error that occurred.
     * @param {HttpResult} httpResult Result being provided for the current operation.
     */
    handleRetryError(e, httpResult) {
        if (e && e.message && e.message === ErrorCodes.USER_CANCELLED) {
            throw new UploadError('user cancelled the operation', ErrorCodes.USER_CANCELLED);
        }
        httpResult.addRetryError(e);
    }
}
