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

import querystring from 'querystring';

import UploadBase from './upload-base';
import { timedRequest } from './http-utils';
import {
    concurrentLoop,
    serialLoop,
} from './utils';
import InitResponse from './init-response';
import UploadFile from './upload-file';
import UploadResult from './upload-result';
import FileUploadResult from './file-upload-result';
import PartUploadResult from './part-upload-result';
import UploadError from './upload-error';

/**
 * Provides capabilities for uploading assets to an AEM instance configured with
 * direct binary access.
 */
export default class DirectBinaryUpload extends UploadBase {
    /**
     * Uploads multiple files to a target AEM instance. Through configuration,
     * supports various potential sources, including a node.js process or a
     * browser.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the upload will behave. See class
     *  documentation for more details.
     * @returns {Promise} Will be resolved when all the files have been uploaded. The data
     *  passed in successful resolution will be various statistics about the upload process.
     */
    async uploadFiles(options) {
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
            const response = await timedRequest(initOptions);
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

        if (concurrent) {
            await concurrentLoop(fileListInit, (file) => this.processFile(options, uploadResult, initResponse, file));
        } else {
            await serialLoop(fileListInit, (file) => this.processFile(options, uploadResult, initResponse, file));
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

        this.logInfo(`Start uploading '${fileName}' to cloud, fileSize: '${fileSize}', parts: '${parts.length}'`);

        const fileUploadResult = new FileUploadResult(initResponseFile);

        fileUploadResult.startTimer();

        await this.uploadToCloud(options, fileUploadResult, parts);

        fileUploadResult.stopTimer();

        this.logInfo(`Finished uploading '${fileName}', took '${fileUploadResult.getTotalUploadTime()}' ms`);

        if (fileUploadResult.isSuccessful()) {
            let completeOptions = {
                url: initResponse.getCompleteUri(),
                method: 'POST',
                headers: {
                    ...headers,
                    'content-type': 'application/x-www-form-urlencoded',
                },
                data: querystring.stringify({
                    fileName,
                    mimeType,
                    uploadToken,
                }),
            };

            try {
                const response = await timedRequest(completeOptions);
                const {
                    elapsedTime: completeElapsedTime = 0,
                    status: completeStatusCode,
                } = response;
                fileUploadResult.setTotalCompleteTime(completeElapsedTime);

                this.logInfo(`Finished complete uploading '${fileName}', response code: '${completeStatusCode}', time elapsed: '${completeElapsedTime}' ms`);
            } catch (e) {
                fileUploadResult.setCompleteError(e);
                this.logError(`Complete uploading error '${fileName}'`, e);
            }
        }

        uploadResult.addFileUploadResult(fileUploadResult);
    }

    /**
     * Performs the work of uploading all parts of a file to the target instance.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the overall upload behaves.
     * @param {FileUploadResult} fileUploadResult Information about the upload process of the individual file will be added
     *  to this result.
     * @param {Array} parts The list of InitResponseFilePart instances that will be used as each part to upload.
     */
    async uploadToCloud(options, fileUploadResult, parts) {
        await serialLoop(parts, part => this.uploadPartToCloud(options, fileUploadResult, part));
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
        if (!fileUploadResult.isSuccessful()) {
            // a part failed to upload, discontinue uploading parts
            return;
        }

        const {
            useContentLengthHeader = true,
        } = options;

         const reqOptions = {
            url: part.getUrl(),
            method: 'PUT',
            data: part.getData(),
        };

        if (useContentLengthHeader) {
            reqOptions.headers = {
                'content-length': part.getSize(),
            };
        }

        try {
            const response = await timedRequest(reqOptions);

            const {
                status: statusCode,
                elapsedTime = 0,
            } = response;

            this.logInfo(`Put upload part done for file: '${part.getFileName()}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}', spent: '${elapsedTime}' ms, status: ${statusCode}`);
            fileUploadResult.addPartResult(new PartUploadResult(part, elapsedTime));
        } catch (e) {
            const partResult = new PartUploadResult(part, 0);
            partResult.setError(e);
            fileUploadResult.addPartResult(partResult);
            this.logError(`Put upload part done for file: '${part.getFileName()}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}'`, e);
        }
    }
}
