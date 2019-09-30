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

/**
 * Represents a part of a file to upload, based on the response from the direct binary upload initiate request.
 */
export default class InitResponseFilePart extends UploadOptionsBase {
    /**
     * Constructs a new part instance, which can be used to retrieve information about the file part.
     *
     * @param {object} options Options as provided when the upload instance was instantiated.
     * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the upload was initiated.
     * @param {object} partOptions Raw part data as received from the direct binary upload initiate request.
     * @param {InitResponseFile} initResponseFile The file on which the part is based.
     */
    constructor(options, uploadOptions, partOptions, initResponseFile) {
        super(options, uploadOptions);
        this.partOptions = partOptions;
        this.fileData = initResponseFile;
    }

    /**
     * Retrieves the name of the file to which the part belongs, as specified in the upload options.
     *
     * @returns {string} The name of the file.
     */
    getFileName() {
        return this.fileData.getFileName();
    }

    /**
     * Retrieves the size of the file, in bytes, as specified in the upload options.
     *
     * @returns {number} The size of the file.
     */
    getSize() {
        return this.getEndOffset() - this.getStartOffset();
    }

    /**
     * Retrieves the byte offset, inclusive, of where in the file this part begins.
     *
     * @returns {number} A file byte offset.
     */
    getStartOffset() {
        return this.partOptions.start;
    }

    /**
     * Retrieves the byte offset, exclusive, of where in the file this part ends.
     *
     * @returns {number} A file byte offset.
     */
    getEndOffset() {
        return this.partOptions.end;
    }

    /**
     * Retrieves the URL to which this file part will be uploaded.
     *
     * @returns {string} A URL.
     */
    getUrl() {
        return this.partOptions.url;
    }

    /**
     * Retrieves the file's actual data for the part, based on the start and end offset.
     *
     * @returns {Readable|Array} A node.js stream, or an array of bytes, containing the part's data.
     */
    getData() {
        return this.fileData.getFileChunk(this.getStartOffset(), this.getEndOffset());
    }

    /**
     * Converts the instance to a simple object representation.
     *
     * @returns {object} The part data in simplified view.
     */
    toJSON() {
        return this.partOptions;
    }
}
