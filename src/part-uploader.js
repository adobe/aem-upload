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
import PartUploadResult from './part-upload-result';
import { serialLoop } from './utils';
import HttpRequest from './http/http-request';

/**
 * Has the responsibility of uploading file parts using HTTP. The uploader
 * has a centralized queue, to which additional parts can be added. The
 * uploader will ensure that a maximum number of parts from this queue
 * are continuously being uploaded concurrently.
 *
 * The uploader will use a FileTransferHandler to provide updates as parts
 * transfer.
 */
export default class PartUploader extends UploadOptionsBase {

    /**
     * Constructs a new uploader with the given dependencies.
     *
     * @param {object} options General direct upload options.
     * @param {DirectBinaryUploadOptions} uploadOptions Options for the current
     *  upload.
     * @param {HttpClient} httpClient Will be used to upload parts that are
     *  provided to the uploader.
     * @param {ConcurrentQueue} concurrentQueue Queue that the uploader will use
     *  to concurrently upload parts, if configured to do so via the upload options.
     */
    constructor(options, uploadOptions, httpClient, concurrentQueue) {
        super(options, uploadOptions);

        this.httpClient = httpClient;
        this.concurrentQueue = concurrentQueue;
    }

    /**
     * Adds the given parts to the uploader's queue, which will ensure that a maximum
     * number of parts are continuously being uploaded simultaneously. Use the class's
     * events to determine individual file status and upload progress.
     *
     * @param {UploadResult} uploadResult Results of each part upload will be added to
     *  this result.
     * @param {Array} parts A list of InitResponseFilePart instances, which will be
     *  added to the upload queue.
     * @param {FileTransferHandler} fileTransferHandler Will be used to provide updates
     *  on the transfer progress of a file.
     */
    async uploadParts(uploadResult, parts, fileTransferHandler) {
        const concurrent = this.getUploadOptions().isConcurrent();

        if (concurrent) {
            this.logInfo(`Concurrently uploading ${parts.length} total parts with a max count of ${this.getUploadOptions().getMaxConcurrent()}`);
            await this.concurrentQueue.pushAll(parts, (part) => this.processPart(uploadResult, part, fileTransferHandler));
        } else {
            this.logInfo(`Serially uploading ${parts.length} total parts`);
            await serialLoop(parts, (part) => this.processPart(uploadResult, part, fileTransferHandler));
        }
    }

    /**
     * Does the work of uploading a single part to its target URL.
     *
     * @param {UploadResult} uploadResult Results for the overall upload.
     * @param {InitResponseFilePart} initResponseFilePart Initialization info about the part currently being processed.
     * @param {FileTransferHandler} fileTransferHandler Will be used to provide updates
     *  on the transfer progress of a file.
     */
    async processPart(uploadResult, initResponseFilePart, fileTransferHandler) {
        const fileName = initResponseFilePart.getFileName();
        const fileSize = initResponseFilePart.getFileSize();

        // if a part fails or is cancelled, then the rest of the file's parts will just
        // drain out of the queue without anything happening to them
        let partResult = false;
        if (await fileTransferHandler.partTransferStarted(uploadResult, initResponseFilePart)) {
            this.logInfo(`Start uploading part for '${fileName}' to cloud, fileSize: '${fileSize}', partSize: '${initResponseFilePart.getSize()}'`);

            partResult = await this.uploadPartToCloud(initResponseFilePart, fileTransferHandler);
        }
        await fileTransferHandler.partTransferEnded(initResponseFilePart, partResult);
    }

    /**
     * Performs the work of uploading a single file part to the target instance.
     *
     * @param {InitResponseFilePart} part The file part whose information will be used to do the upload.
     * @param {FileTransferHandler} fileTransferHandler Will be used to provide updates
     *  on the transfer progress of a file.
     */
    async uploadPartToCloud(part, fileTransferHandler) {
        const data = part.getData();
        const fileName = part.getFileName();
        const partRequest = new HttpRequest(this.getOptions(), part.getUrl())
            .withMethod(HttpRequest.Method.PUT)
            .withData(data, part.getSize())
            .withCancelId(part.getTargetFilePath())
            .withTimeout(this.getUploadOptions().getHttpRequestTimeout());

        partRequest.on('progress', (progressData) => {
            fileTransferHandler.partTransferProgress(part, progressData);
        });

        const partResult = new PartUploadResult(this.getOptions(), this.getUploadOptions(), part);
        try {
            const response = await this.httpClient.submit(partRequest, partResult);

            const statusCode = response.getStatusCode();
            const elapsedTime = response.getElapsedTime();

            this.logInfo(`Put upload part done for file: '${fileName}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}', spent: '${elapsedTime}' ms, status: ${statusCode}`);
            partResult.setUploadTime(elapsedTime);
        } catch (e) {
            partResult.setError(e);
            this.logError(`Put upload part done for file: '${fileName}', offset: '${part.getStartOffset()}-${part.getEndOffset()}', partSize: '${part.getSize()}'`, e);
        }

        return partResult;
    }

}
