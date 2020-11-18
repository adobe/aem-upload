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

import InitResponse from './init-response';
import UploadFile from './upload-file';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';
import { 
    updateOptionsWithResponse,
} from './http-utils';
import PartUploader from './part-uploader';
import HttpRequest from './http/http-request';
import FileTransferHandler from './file-transfer-handler';
import ConcurrentQueue from './concurrent-queue';

/**
 * Contains all logic for the process that uploads a set of files using direct binary access.
 *
 * The process will send events as a file is uploaded. Each event will be sent with
 * an object containing the following elements:
 * * {string} fileName: Name of the file being uploaded.
 * * {number} fileSize: Total size of the file, in bytes.
 * * {string} targetFolder: Full path to the AEM folder where the file is being
 *   uploaded.
 * * {string} targetFile: Full path to the file in AEM.
 * * {string} mimeType: Mime type of the file being uploaded.
 *
 * Some events may send additional pieces of information, which will be noted
 * in the event itself. The events are:
 *
 * * filestart: Sent when the first part of a file begins to upload.
 * * fileprogress: Sent periodically to report on how much of the file has
 *   uploaded. The event data will include these additional elements:
 *   * {number} transferred: The total number of bytes that have transferred for
 *     the file so far.
 * * fileend: Sent after the last part of a file has uploaded successfully. Will only
 *   be sent if the file transfers completely.
 * * filecancelled: Sent if the file was cancelled before it could finish.
 * * fileerror: Sent if one of the file's parts failed to transfer. The event data
 *   will include these additional elements:
 *   * {Array} errors: List of errors that occurred to prevent the upload.
 */
export default class DirectBinaryUploadProcess extends FileTransferHandler {
    /**
     * Constructs a new instance of the upload process for a single directory.
     * @param {object} options Overall direct binary process options.
     * @param {DirectBinaryUploadOptions} uploadOptions Options specific to the
     *  current upload.
     * @param {HttpClient} [httpClient] Client to use to submit HTTP requests. If
     *  not specified then the process will create its own.
     * @param {PartUpload} [partUploader] Upload to use when uploading file parts.
     *  If not specified then the process will create its own.
     */
    constructor(options, uploadOptions, httpClient = false, partUploader = false) {
        super(options, uploadOptions, httpClient);

        this.partUploader = partUploader;
        if (!this.partUploader) {
            this.partUploader = new PartUploader(options, uploadOptions, this.getHttpClient(),
                new ConcurrentQueue(options, uploadOptions));
        }

        this.fileResults = {};
        this.fileEvents = {};
        this.fileTransfer = {};
        this.completeUri = '';
    }

    /**
     * Does the work of uploading all files based on the upload options provided to the process.
     *
     * @param {UploadResult} uploadResult Result to which information about the upload will be
     *  added.
     * @returns {Promise} Resolves when all files have been uploaded.
     */
    async upload(uploadResult) {
        const initResponse = await this.initiateUpload(uploadResult);
        this.completeUri = initResponse.getCompleteUri();

        await this.partUploader.uploadParts(uploadResult, initResponse.getAllParts(), this);

        uploadResult.stopTimer();

        // output json result to logger
        this.logInfo('Uploading result in JSON: ' + JSON.stringify(uploadResult, null, 4));
    }

    /**
     * Does the work of initiating an upload by calling the initiateUpload servlet.
     *
     * @param {UploadResult} uploadResult Result to which information about the upload will be added.
     * @param {Array} [uploadFiles] If specified, will be used in place of the upload files in the
     *  process's upload options.
     * @returns {InitResponse} Information about the response from the initiateUpload servlet.
     */
    async initiateUpload(uploadResult, uploadFiles = false) {
        let options = this.getUploadOptions();
        const url = options.getUrl();
        const targetFolder = options.getTargetFolderPath();
        const targetFiles = uploadFiles ? uploadFiles : options.getUploadFiles();
        const toUpload = targetFiles.map(upload => new UploadFile(this.getOptions(), options, upload));

        uploadResult.startTimer();

        const initRequest = new HttpRequest(this.getOptions(), `${url}.initiateUpload.json`)
            .withMethod(HttpRequest.Method.POST)
            .withContentType('application/x-www-form-urlencoded')
            .withData(querystring.stringify({
                path: targetFolder,
                fileName: toUpload.map(file => file.getFileName()),
                fileSize: toUpload.map(file => file.getFileSize()),
            }))
            .withResponseType(HttpRequest.ResponseType.JSON)
            .withUploadOptions(this.getUploadOptions());

        let initResponse;
        let fileListInit;

        this.logDebug(`Initiating upload to ${url}`);

        const response = await this.getHttpClient().submit(initRequest, uploadResult);

        const statusCode = response.getStatusCode();
        const resObj = response.getData();
        const elapsedTime = response.getElapsedTime();

        updateOptionsWithResponse(options, response);

        this.logInfo(`Finished initialize uploading, response code: '${statusCode}', time elapsed: '${elapsedTime}' ms`);

        this.logInfo('Init upload result: ' + JSON.stringify(resObj, null, 4));

        initResponse = new InitResponse(this.getOptions(), options, toUpload, resObj);
        fileListInit = initResponse.getFiles();

        if (!fileListInit.length || !fileListInit[0].getUploadUris().length) {
            throw new UploadError('direct binary access not supported', ErrorCodes.NOT_SUPPORTED);
        }

        uploadResult.addInitTime(elapsedTime);
        uploadResult.addTotalFiles(fileListInit.length);

        return initResponse;
    }

    /**
     * Does the work of completing an upload by submitting a request to the complete upload servlet.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the method behaves.
     * @param {FileUploadResult} fileUploadResult Information about the complete request will
     *  be added to the result.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve the file's
     *  information.
     */
    async completeUpload(fileUploadResult, initResponseFileInfo) {
        const options = this.getUploadOptions();
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

        const urlEncodedData = querystring.stringify(completeData);
        const completeRequest = new HttpRequest(this.getOptions(), this.completeUri)
            .withContentType('application/x-www-form-urlencoded')
            .withMethod(HttpRequest.Method.POST)
            .withData(urlEncodedData, urlEncodedData.length)
            .withUploadOptions(options);

        try {
            const response = await this.getHttpClient().submit(completeRequest, fileUploadResult);
            const completeElapsedTime = response.getElapsedTime();
            const completeStatusCode = response.getStatusCode();

            fileUploadResult.setTotalCompleteTime(completeElapsedTime);

            this.logInfo(`Finished complete uploading '${fileName}', response code: '${completeStatusCode}', time elapsed: '${completeElapsedTime}' ms`);
        } catch (e) {
            this.logError(`Error while completing uploading for file '${fileName}'`, e);
            fileUploadResult.setCompleteError(e);
            this.sendEvent('fileerror', {
                ...initResponseFileInfo.getFileEventData(),
                errors: [e]
            });
            return;
        }

        this.sendEvent('fileend', initResponseFileInfo.getFileEventData());
    }

    /**
     * Overridden to send the 'filestart' event.
     * @param {FileUploadResult} fileUploadResult Unused.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to build event data
     *  for the event.
     */
    async _doFileTransferStarted(fileUploadResult, initResponseFileInfo) {
        this.sendEvent('filestart', initResponseFileInfo.getFileEventData());
    }

    /**
     * Overridden to send the 'fileprogress' event.
     * @param {FileUploadResult} fileUploadResult Unused.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to build event data
     *  for the event.
     * @param {number} transferredBytes Sent with the event.
     */
    async _doFileTransferProgress(fileUploadResult, initResponseFileInfo, transferredBytes) {
        this.sendEvent('fileprogress', {
            ...initResponseFileInfo.getFileEventData(),
            transferred: transferredBytes
        });
    }

    /**
     * Overridden to complete the upload process for the file.
     * @param {FileUploadResult} fileUploadResult Used to update complete statistics.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to retrieve various
     *  pieces of information about the file.
     */
    async _doFileTransferSucceeded(fileUploadResult, initResponseFileInfo) {
        return this.completeUpload(fileUploadResult, initResponseFileInfo);
    }

    /**
     * Overridden to send the 'fileend' event.
     * @param {FileUploadResult} fileUploadResult Unused.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to build event data
     *  for the event.
     */
    async _doFileTransferError(fileUploadResult, initResponseFileInfo) {
        this.sendEvent('fileerror',
        {
            ...initResponseFileInfo.getFileEventData(),
            errors: fileUploadResult.getErrors()
        });
    }

    /**
     * Overridden to send the 'filecancelled' event.
     * @param {FileUploadResult} fileUploadResult Unused.
     * @param {InitResponseFileInfo} initResponseFileInfo Used to build event data
     *  for the event.
     */
    async _doFileTransferCancelled(fileUploadResult, initResponseFileInfo) {
        this.sendEvent('filecancelled', initResponseFileInfo.getFileEventData());
    }

}
