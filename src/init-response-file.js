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

import InitResponseFileInfo from './init-response-file-info';
import InitResponseFilePart from './init-response-file-part';

/**
 * Represents information about a file as received from the direct binary upload initiate request.
 */
export default class InitResponseFile extends InitResponseFileInfo {
    /**
     * Constructs a new file instance using the provided information.
     *
     * @param {object} options Options controlling the overall process.
     * @param {DirectBinaryUploadOptions} uploadOptions Options controlling the upload process.
     * @param {UploadFile} uploadFile The original upload file from which the init data is based.
     * @param {object} fileData Raw file data as received from the init api.
     */
    constructor(options, uploadOptions, uploadFile, fileData) {
        super(options, uploadOptions, uploadFile, fileData);
    }

    /**
     * Calculates and retrieves all the parts in which the file will be uploaded. This will be calculated
     * based on the number of URIs, the size of the file, and the file's getFilePartSize() value.
     *
     * @returns {Array} A list of InitResponseFilePart instances.
     */
    getParts() {
        const parts = [];
        const uploadURIs = this.getUploadUris();
        const partSize = this.getFilePartSize();
        const fileSize = this.getFileSize();
        for (let index = 0; index < uploadURIs.length; index++) {
            const uploadUrl = uploadURIs[index];

            const start = index * partSize;
            let end = start + partSize;
            if (end > fileSize) {
                end = fileSize;
            }
            this.logDebug(`Generate uploading part for file '${this.getFileName()}', index: '${index}', file range: '${start} - ${end}'`);
            parts.push(new InitResponseFilePart(
                this.getOptions(),
                this.getUploadOptions(),
                this.uploadFile,
                this.fileData,
                {
                    start,
                    end,
                    url: uploadUrl
                })
            );
        }
        return parts;
    }
}
