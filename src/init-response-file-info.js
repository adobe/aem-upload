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

import UploadOptionsBase from './upload-options-base';

export default class InitResponseFileInfo extends UploadOptionsBase {
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
     * This value will not be URL encoded.
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
     * Retrieves a value indicating whether or not a new version of the file should be
     * created if it already exists.
     *
     * @returns {boolean} True if a new version should be created, false otherwise.
     */
    shouldCreateNewVersion() {
        return this.uploadFile.shouldCreateNewVersion();
    }

    /**
     * Retrieves the label of the new version should one need to be created.
     *
     * @returns {string} A version label.
     */
    getVersionLabel() {
        return this.uploadFile.getVersionLabel();
    }

    /**
     * Retrieves the comment of the new version should one need to be created.
     *
     * @returns {string} A version comment.
     */
    getVersionComment() {
        return this.uploadFile.getVersionComment();
    }

    /**
     * Retrieves a value indicating whether or not the asset should be replaced if
     * it already exists.
     *
     * @returns {boolean} True if the asset should be replaced, false otherwise.
     */
    shouldReplace() {
        return this.uploadFile.shouldReplace();
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
     * Retrieves a raw value from the file's data.
     *
     * @param {string} propertyName
     * @returns {*} The corresponding property value, or undefined if not found.
     */
    getFileData(propertyName) {
        return this.fileData[propertyName];
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
     * Retrieves the file's information that should be included in events relating to the file.
     *
     * @returns {object} Event information for the file.
     */
    getFileEventData() {
        const targetFolder = this.getUploadOptions().getTargetFolderPath();
        return {
            fileName: this.getFileName(),
            fileSize: this.getFileSize(),
            targetFolder,
            targetFile: `${targetFolder}/${this.getFileName()}`,
            mimeType: this.getMimeType(),
        };
    }

    /**
     * Retrieves the total number of parts for the file.
     *
     * @return {number} Part count.
     */
    getFilePartCount() {
        return this.getUploadUris().length;
    }

    /**
     * Calculates the part size for each part in which the file should be uploaded. This is calculated based
     * on the total size of the file and the number of upload URIs provided by the init API.
     *
     * @returns {number} Part size in bytes.
     */
    getFilePartSize() {
        const fileSize = this.getFileSize();
        const numUris = this.getUploadUris().length;
        const partSize = Math.ceil(fileSize / numUris);

        return partSize;
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