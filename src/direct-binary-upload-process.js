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

            uploadResult.setInitTime(elapsedTime);
            uploadResult.setTotalFiles(fileListInit.length);
        } catch (e) {
            throw UploadError.fromError(e, 'unable to initiate upload');
        }

        const uploadProcess = new DirectBinaryUploadProcess(this.getOptions(), options);

        uploadProcess.on('filestart', data => this.sendEvent('filestart', data));
        uploadProcess.on('fileprogress', data => this.sendEvent('fileprogress', data));
        uploadProcess.on('fileend', data => this.sendEvent('fileend', data));
        uploadProcess.on('fileerror', data => this.sendEvent('fileerror', data));
        uploadProcess.on('filecancelled', data => this.sendEvent('filecancelled', data));

        const controller = options.getController();

        controller.on('cancel', data => {
            uploadProcess.cancel(data);
        });

        if (concurrent) {
            await concurrentLoop(
                fileListInit,
                options.getMaxConcurrent(),
                (file) => uploadProcess.processFile(options, uploadResult, initResponse, file));
        } else {
            await serialLoop(fileListInit, (file) => uploadProcess.processFile(options, uploadResult, initResponse, file));
        }

        uploadResult.stopTimer();

        // output json result to logger
        this.logInfo('Uploading result in JSON: ' + JSON.stringify(uploadResult, null, 4));

        return uploadResult;
    }

    /**
     * Does the work of uploading a single file to the target AEM instance.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the method behaves.
     * @param {UploadResult} uploadResult Results for the overall upload.
     * @param {InitResponse} initResponse The response data from the init request.
     * @param {InitResponseFile} initResponseFile Initialization info about the file currently being processed.
     */
    async processFile(options, uploadResult, initResponse, initResponseFile) {
        const headers = options.getHeaders();
        const fileName = initResponseFile.getFileName();
        const fileSize = initResponseFile.getFileSize();
        const mimeType = initResponseFile.getMimeType();
        const uploadToken = initResponseFile.getUploadToken();
        const parts = initResponseFile.getParts();

        let success = false;
        const eventData = initResponseFile.getEventData();
        const fileUploadResult = new FileUploadResult(this.getOptions(), options, initResponseFile);

        if (!this.isCancelled(initResponseFile.getFileName())) {
            initResponseFile.on('progress', progress => {
                const { fileName, fileSize, transferred } = progress;
                this.logInfo(`Upload of ${fileName} ${Math.round(transferred / fileSize * 100)}% complete`);
                this.sendEvent('fileprogress', progress);
            });

            this.logInfo(`Start uploading '${fileName}' to cloud, fileSize: '${fileSize}', parts: '${parts.length}'`);

            fileUploadResult.startTimer();

            this.sendEvent('filestart', eventData);
            await this.uploadToCloud(options, initResponseFile, fileUploadResult, parts);

            fileUploadResult.stopTimer();

            this.logInfo(`Finished uploading '${fileName}', took '${fileUploadResult.getTotalUploadTime()}' ms`);

            if (fileUploadResult.isSuccessful() && !this.isCancelled(initResponseFile.getFileName())) {
                const completeData = {
                    fileName,
                    mimeType,
                    uploadToken,
                    uploadDuration: fileUploadResult.getTotalUploadTime(),
                };

                if (initResponseFile.shouldCreateNewVersion()) {
                    completeData.createVersion = true;

                    const versionLabel = initResponseFile.getVersionLabel();
                    const versionComment = initResponseFile.getVersionComment();
                    if (versionLabel) {
                        completeData.versionLabel = versionLabel;
                    }
                    if (versionComment) {
                        completeData.versionComment = versionComment;
                    }
                } else if (initResponseFile.shouldReplace()) {
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

                try {
                    const cancelToken = this.addCancelToken(fileName, 'complete');
                    const response = await timedRequest(completeOptions, this.getRetryOptions(options, fileUploadResult), cancelToken);
                    this.removeCancelToken(fileName, 'complete');
                    const {
                        elapsedTime: completeElapsedTime = 0,
                        status: completeStatusCode,
                    } = response;
                    fileUploadResult.setTotalCompleteTime(completeElapsedTime);

                    this.logInfo(`Finished complete uploading '${fileName}', response code: '${completeStatusCode}', time elapsed: '${completeElapsedTime}' ms`);
                    success = true;
                } catch (e) {
                    fileUploadResult.setCompleteError(e);
                    this.logError(`Complete uploading error '${fileName}'`, e);
                }
            }
        }

        if (this.isCancelled(initResponseFile.getFileName())) {
            fileUploadResult.setIsCancelled(true);
            this.sendEvent('filecancelled', eventData);
        } else if (!success) {
            this.sendEvent('fileerror', {
                ...eventData,
                errors: fileUploadResult.getErrors(),
            });
        } else {
            this.sendEvent('fileend', eventData);
        }

        uploadResult.addFileUploadResult(fileUploadResult);
    }

    /**
     * Performs the work of uploading all parts of a file to the target instance.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the overall upload behaves.
     * @param {InitResponseFile} initResponseFile The file being uploaded to the cloud.
     * @param {FileUploadResult} fileUploadResult Information about the upload process of the individual file will be added
     *  to this result.
     * @param {Array} parts The list of InitResponseFilePart instances that will be used as each part to upload.
     */
    async uploadToCloud(options, initResponseFile, fileUploadResult, parts) {
        await serialLoop(parts, part => this.uploadPartToCloud(options, initResponseFile, fileUploadResult, part));
    }

    /**
     * Performs the work of uploading a single file part to the target instance.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the overall upload behaves.
     * @param {InitResponseFile} initResponseFile The file being uploaded to the cloud.
     * @param {FileUploadResult} fileUploadResult Information about the upload process of the individual file will be added
     *  to this result.
     * @param {InitResponseFilePart} part The file part whose information will be used to do the upload.
     */
    async uploadPartToCloud(options, initResponseFile, fileUploadResult, part) {
        if (!fileUploadResult.isSuccessful() || this.isCancelled(initResponseFile.getFileName())) {
            // discontinue uploading parts
            return;
        }

        const data = part.getData();
        const reqOptions = {
            url: part.getUrl(),
            method: 'PUT',
            data,
        };

        let totalTransferred = 0;
        if (data.on) {
            data.on('data', chunk => {
                totalTransferred += chunk.length;
                initResponseFile.sendProgress(part.getStartOffset(), totalTransferred);
            });
        } else {
            reqOptions.onUploadProgress = progress => {
                const { loaded } = progress;
                if (loaded) {
                    initResponseFile.sendProgress(part.getStartOffset(), loaded);
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
            const cancelToken = this.addCancelToken(initResponseFile.getFileName(), tokenName);
            const response = await timedRequest(reqOptions, this.getRetryOptions(options, partResult), cancelToken);
            this.removeCancelToken(initResponseFile.getFileName(), tokenName);

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
     * @param {string} fileName The name of an upload file.
     */
    isCancelled(fileName) {
        return this.cancelled || !!this.cancelledFiles[fileName];
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
