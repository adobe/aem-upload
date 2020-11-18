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

import UploadOptionsBase from './upload-options-base';
import HttpClient from './http/http-client';
import FileUploadResult from './file-upload-result';

const DEFAULT_PROGRESS_THRESHOLD = 500;

/**
 * The purpose of this class is to coordinate the complete transfer of a file,
 * based on a process that transfers said file in multiple parts.
 *
 * This class will handle determining when a file starts transferring, and
 * when a file finishes transferring, either successfully or in failure.
 */
export default class FileTransferHandler extends UploadOptionsBase {

    /**
     * Constructs a new instance of the handler.
     * @param {object} options Direct binary process level options.
     * @param {DirectBinaryUploadOptions} uploadOptions Used to retrieve
     *  various information about the current upload.
     * @param {HttpClient} httpClient Used to check whether files have
     *  been cancelled or not.
     */
    constructor(options, uploadOptions, httpClient) {
        super(options, uploadOptions);

        this.httpClient = httpClient;

        if (!this.httpClient) {
            this.httpClient = new HttpClient(options, uploadOptions);
        }

        this.fileUploadResults = {};
        this.endedFileUploadResults = {};
        this.progressEvents = {};
        this.totalFileTransferred = {};
    }

    /**
     * Retrieves the HTTP client that the handler is using to monitor
     * cancellations.
     */
    getHttpClient() {
        return this.httpClient;
    }

    /**
     * This method is intended to be called whenever a file part begins uploading. The handler
     * will determine if it's the first part of a new file, and perform actions accordingly.
     * @param {UploadResult} uploadResult Result for the part's file will be added when
     *  necessary.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve information about
     *  the file.
     * @returns {boolean} Returns true if processing of the part should continue. If processing
     *  should stop (i.e. in the case where the file was cancelled) then the return value will
     *  be false.
     */
    async partTransferStarted(uploadResult, initResponseFileInfo) {
        const fileName = initResponseFileInfo.getFileName();
        const filePath = initResponseFileInfo.getTargetFilePath();
        if (!this.fileUploadResults[fileName]) {
            const fileUploadResult = new FileUploadResult(this.getOptions(), this.getUploadOptions(), initResponseFileInfo);
            this.fileUploadResults[fileName] = fileUploadResult;

            this.logInfo(`Starting to upload file ${fileName}`);

            fileUploadResult.startTimer();
            uploadResult.addFileUploadResult(fileUploadResult);

            if (!this.httpClient.isCancelled(filePath)) {
                await this._doFileTransferStarted(fileUploadResult, initResponseFileInfo);
            }
        }

        return !this.httpClient.isCancelled(filePath) && this.fileUploadResults[fileName].isSuccessful();
    }

    /**
     * This method is intended to be called whenever a file's part finishing transferring. The
     * method will determine the status of the file (i.e. completed, failed, or cancelled),
     * and perform actions accordingly.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve information about
     *  the file.
     * @param {PartResult} [partResult] If specified, will be added to the file's results.
     */
    async partTransferEnded(initResponseFileInfo, partResult = false) {
        const fileName = initResponseFileInfo.getFileName();
        const filePath = initResponseFileInfo.getTargetFilePath();
        const fileUploadResult = this.fileUploadResults[fileName];
        if (fileUploadResult && !this.endedFileUploadResults[fileName]) {
            if (partResult) {
                fileUploadResult.addPartResult(partResult);
            }

            let handler = false;
            if (this.httpClient.isCancelled(filePath)) {
                this.logInfo(`File upload for ${filePath} was cancelled by user`);

                fileUploadResult.setIsCancelled(true);

                handler = this._doFileTransferCancelled;
            } else if (!fileUploadResult.isSuccessful()) {
                this.logInfo(`File upload for ${fileName} failed due to error`);

                handler = this._doFileTransferError;
            } else if (initResponseFileInfo.getFilePartCount() === fileUploadResult.getPartCount()) {
                this.logInfo(`Finished uploading file ${fileName}`);

                handler = this._doFileTransferSucceeded;
            }

            if (handler) {
                this.endedFileUploadResults[fileName] = true;
                fileUploadResult.stopTimer();
                await handler.call(this, fileUploadResult, initResponseFileInfo);
            }
        }
    }

    /**
     * This method is intended to be called whenever meaningful progress has been made
     * in the transfer of part of a file. The method will keep a running total of the
     * amount of data that has transferred for the file, and will ensure that consumers
     * are notified of the progress on a periodic basis.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve information
     *  about the file.
     * @param {number} transferredBytes Number of bytes that have transferred for the
     *  file since the last time the progress event was called for that file.
     */
    async partTransferProgress(initResponseFileInfo, transferredBytes) {
        const fileName = initResponseFileInfo.getFileName();
        const fileUploadResult = this.fileUploadResults[fileName];

        if (fileUploadResult && !this.endedFileUploadResults[fileName]) {
            if (!this.totalFileTransferred[fileName]) {
                this.totalFileTransferred[fileName] = 0;
            }

            // keep track of total bytes transferred across all parts for the file
            this.totalFileTransferred[fileName] += transferredBytes;

            const lastEvent = this.progressEvents[fileName] || 0;
            const now = new Date().getTime();
            const { progressDelay = DEFAULT_PROGRESS_THRESHOLD } = this.getOptions();

            if (now - lastEvent > progressDelay) {
                this.progressEvents[fileName] = now;
                await this._doFileTransferProgress(fileUploadResult, initResponseFileInfo, this.totalFileTransferred[fileName]);
            }
        }
    }

    /**
     * This method will be called once if all parts of a file transfer successfully. Only one of
     * _doFileTransferSucceeded, _doFileTransferError, or _doFileTransferCancelled will be
     * called, depending on the status of the file transfer. The default implementation does nothing.
     * @param {FileUploadResult} fileUploadResult Statistics about the overall transfer process
     *  of the file.
     * @param {InitResponseFileInfo} initResponseFileInfo Provides various information about the
     *  file.
     */
    async _doFileTransferSucceeded(/* fileUploadResult, initResponseFileInfo */) {
        this.logWarn('_doFileTransferSucceeded: unimplemented parent method called.');
    }

    /**
     * This method will be called once if any of the file's parts fails to transfer. Only one of
     * _doFileTransferSucceeded, _doFileTransferError, or _doFileTransferCancelled will be
     * called, depending on the status of the file transfer. The default implementation does nothing.
     * @param {FileUploadResult} fileUploadResult Statistics about the overall transfer process
     *  of the file.
     * @param {InitResponseFileInfo} initResponseFileInfo Provides various information about the
     *  file.
     */
    async _doFileTransferError(/* fileUploadResult, initResponseFileInfo */) {
        this.logWarn('_doFileTransferError: unimplemented parent method called.');
    }

    /**
     * This method will be called once if a file's transfer is cancelled by the user. Only one of
     * _doFileTransferSucceeded, _doFileTransferError, or _doFileTransferCancelled will be
     * called, depending on the status of the file transfer. The default implementation does nothing.
     * @param {FileUploadResult} fileUploadResult Statistics about the overall transfer process
     *  of the file.
     * @param {InitResponseFileInfo} initResponseFileInfo Provides various information about the
     *  file.
     */
    async _doFileTransferCancelled(/* fileUploadResult, initResponseFileInfo */) {
        this.logWarn('_doFileTransferCancelled: unimplemented parent method called.');
    }

    /**
     * This method will be called once when one of file's parts begins to transfer. The default
     * implementation does nothing.
     * @param {FileUploadResult} fileUploadResult Statistics about the overall transfer process
     *  of the file.
     * @param {InitResponseFileInfo} initResponseFileInfo Provides various information about the
     *  file.
     */
    async _doFileTransferStarted(/* fileUploadResult, initResponseFileInfo */) {
        this.logWarn('_doFileTransferStarted: unimplemented parent method called.');
    }

    /**
     * This method will be called on a metered basis when progress is made while transferring any of
     * the file's parts. The default implementation does nothing.
     * @param {FileUploadResult} fileUploadResult Statistics about the overall transfer process
     *  of the file.
     * @param {InitResponseFileInfo} initResponseFileInfo Provides various information about the
     *  file.
     * @param {number} totalTransferredBytes The total number of bytes that have been transferred for
     *  the file.
     */
    async _doFileTransferProgress(/* fileUploadResult, initResponseFileInfo, totalTransferredBytes */) {
        this.logWarn('_doFileTransferProgress: unimplemented parent method called.');
    }
}
