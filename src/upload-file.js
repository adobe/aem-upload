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

import fs from 'fs';

import UploadOptionsBase from './upload-options-base';
import UploadError from './upload-error';
import ErrorCodes from './error-codes';

/**
 * Analyzes the given file options and determines if there is sufficient information
 * to upload the file. If insufficient, the method will throw an exception.
 *
 * @param {object} options Information about the file to upload.
 */
function ensureRequiredOptions(options) {
    if (
        !options.fileName
        || !options.fileSize
        || (!options.filePath &&
            (!options.blob || !options.blob.slice))
    ) {
        throw new UploadError('UploadFile missing required fields. Must have fileName, fileSize, and either filePath or blob', ErrorCodes.INVALID_OPTIONS);
    }
}

/**
 * Represents a file to upload, as provided in upload options. Includes information like the file's name and size.
 * Also provide capabilities for reading chunks of the file.
 */
export default class UploadFile extends UploadOptionsBase {
    /**
     * Constructs a new instance based on the given information.
     *
     * @param {object} options Options as provided when the direct binary upload was instantiated.
     * @param {DirectBinaryUploadOptions} uploadOptions  Options as provided when the upload was initiated.
     * @param {object} fileOptions Options for the specific file, as provided in the upload options.
     * @param {string} fileOptions.fileName The name of the file as it should appear when uploaded.
     * @param {number} fileOptions.fileSize Total size of the file to upload, in bytes.
     * @param {string} [fileOptions.filePath] Full path to the local filesystem file to upload. Either this value or "blob" must be provided.
     * @param {Array} [fileOptions.blob] Full binary content of the file to upload. Either this value or "filePath" must be provided.
     */
    constructor(options, uploadOptions, fileOptions) {
        super(options, uploadOptions);
        this.fileOptions = fileOptions;
    }

    /**
     * Retrieves the name of the file as provided in the options.
     *
     * @returns {string} Name of the file.
     */
    getFileName() {
        ensureRequiredOptions(this.fileOptions);
        return this.fileOptions.fileName;
    }

    /**
     * Retrieves the size of the file, in bytes, as provided in the options.
     *
     * @returns {number} Size of the file.
     */
    getFileSize() {
        ensureRequiredOptions(this.fileOptions);
        return this.fileOptions.fileSize;
    }

    /**
     * Retrieves a chunk of the file for processing, based on the start and end
     * offset. The type of value returned by this method will vary depending on
     * the file options that were provided to the constructor.
     * @param {number} start Byte offset, inclusive, within the file where the chunk will begin.
     * @param {number} end Byte offset, exclusive, within the file where the chunk will end.
     * @returns {Readable|Array} If "filePath" was provided in the file options when constructed,
     *  then the return value will be a Readable stream. If "blob" was provided in the file options
     *  then the return value will be an Array.
     */
    getFileChunk(start, end) {
        ensureRequiredOptions(this.fileOptions);
        const {
            filePath,
            blob,
        } = this.fileOptions;

        if (filePath) {
            return fs.createReadStream(filePath, { start, end });
        }
        return blob.slice(start, end);
    }

    /**
     * Converts the class instance into a simple object representation.
     *
     * @returns {object} Simplified view of the class instance.
     */
    toJSON() {
        const {
            fileName,
            fileSize,
            filePath,
        } = this.fileOptions;
        const json = {
            fileName,
            fileSize,
        }

        if (filePath) {
            json.filePath = filePath;
        }
        return json;
    }
}