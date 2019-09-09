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

import UploadOptionsBase from './upload-options-base';
import InitResponseFilePart from './init-response-file-part';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';

/**
 * Represents information about a file as received from the direct binary upload initiate request.
 */
export default class InitResponseFile extends UploadOptionsBase {
    /**
     * Constructs a new file instance using the provided information.
     *
     * @param {object} options Options controlling the overall process.
     * @param {DirectBinaryUploadOptions} uploadOptions Options controlling the upload process.
     * @param {UploadFile} uploadFile The original upload file from which the init data is based.
     * @param {object} fileData Raw file data as received from the init api.
     */
    constructor(options, uploadOptions, uploadFile, fileData) {
        super(options, uploadOptions);
        this.uploadFile = uploadFile;
        this.fileData = fileData;
    }

    /**
     * Retrieves all of the URIs to which the file should be uploaded. Multiple URIs indicate that
     * the file should be uploaded in parts.
     *
     * @returns {Array} An array of URIs.
     */
    getUploadUris() {
        const { uploadURIs = [] } = this.fileData;
        return uploadURIs;
    }

    /**
     * Retrieves the upload token for the file, which should be used when sending the complete
     * direct binary upload request.
     *
     * @returns {string} The file's upload token.
     */
    getUploadToken() {
        return this.fileData.uploadToken;
    }

    /**
     * Retrieves the full path to the location where the file will be uploaded in the target instance.
     *
     * @returns {string} Full path to the file.
     */
    getTargetFilePath() {
        return `${this.getUploadOptions().getTargetFolderPath()}/${this.getFileName()}`;
    }

    /**
     * Retrieves the name of the file as provided in the upload options.
     *
     * @returns {string} The file's name.
     */
    getFileName() {
        return this.fileData.fileName;
    }

    /**
     * Retrieves the size of the file, in bytes, as provided in the upload options.
     *
     * @returns {number} File size in bytes.
     */
    getFileSize() {
        return this.uploadFile.getFileSize();
    }

    /**
     * Retrieves the mime type of the file, which will be an HTTP content type.
     *
     * @returns {string} An HTTP content type value.
     */
    getMimeType() {
        return this.fileData.mimeType;
    }

    /**
     * Retrieves the maximum size, in bytes, that any one part of the file can be when uploading.
     *
     * @returns {number} Size in bytes.
     */
    getMaxPartSize() {
        return this.fileData.maxPartSize;
    }

    /**
     * Retrieves the minimum size, in bytes, that any one part of the file must be when uploading.
     *
     * @returns {number} Size in bytes.
     */
    getMinPartSize() {
        return this.fileData.minPartSize;
    }

    /**
     * Calculates and retrieves all the parts in which the file will be uploaded. This will be calculated
     * based on the number of URIs, the size of the file, and the file's getPartSize() value.
     *
     * @returns {Array} A list of InitResponseFilePart instances.
     */
    getParts() {
        const parts = [];
        const uploadURIs = this.getUploadUris();
        const partSize = this.getPartSize();
        const fileSize = this.getFileSize();
        for (let index = 0; index < uploadURIs.length; index++) {
            const uploadUrl = uploadURIs[index];

            const start = index * partSize;
            const end = start + partSize;
            if (end > fileSize) {
                end = fileSize;
            }
            this.logDebug(`Generate uploading part for file '${this.getFileName()}', index: '${index}', file range: '${start} - ${end}'`);
            parts.push(new InitResponseFilePart(
                this.getOptions(),
                this.getUploadOptions(),
                {
                    start,
                    end,
                    url: uploadUrl,
                },
                this)
            );
        }
        return parts;
    }

    /**
     * Calculates the part size for each part in which the file should be uploaded. This is calculated based
     * on the file's size, the number of upload URIs, and the minimum/maximum part size values.
     *
     * @returns {number} Part size in bytes.
     */
    getPartSize() {
        const fileSize = this.getFileSize();
        const maxPartSize = this.getMaxPartSize();
        const minPartSize = this.getMinPartSize();
        const uploadURIs = this.getUploadUris();

        if (maxPartSize > 0) {
            const numParts = Math.ceil(fileSize / maxPartSize);
            if (numParts > uploadURIs.length) {
                throw new UploadError(`number of parts (${numParts}) is more than the number of available part urls (${uploadURIs.length})`, ErrorCodes.INVALID_OPTIONS);
            }
        }

        let urlNum = uploadURIs.length;
        let partSize;
        // if file size is less than minimum part size, use the file's size
        if (fileSize < minPartSize) {
            partSize = fileSize;
            if (urlNum !== 1) {
                throw new UploadError(`fileSize less than min part size must only have one url`, ErrorCodes.INVALID_OPTIONS);
            }
        } else {
            // calculate part size based on number of urls
            partSize = Math.floor((fileSize + urlNum - 1) / urlNum);
            // if average partSize is smaller than minPartSize, use minPartSize instead
            if (partSize < minPartSize) {
                partSize = minPartSize;
            }
        }

        return partSize;
    }

    /**
     * Retrieves data from the target file, based on a byte range within the file.
     *
     * @param {number} startOffset The byte offset, inclusive, within the file where the chunk should start.
     * @param {number} endOffset The byte offset, exclusive, within the file where the chunk should end.
     * @returns {Readable|Array} Either a stream or an array containing the requested byte range.
     */
    getFileChunk(startOffset, endOffset) {
        return this.uploadFile.getFileChunk(startOffset, endOffset);
    }

    /**
     * Converts the instance into a simple object containing the class's relevant data.
     *
     * @return {object} A simplified view of the instance.
     */
    toJSON() {
        return this.fileData;
    }
}
