/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import { getAverage } from './utils';
import UploadOptionsBase from './upload-options-base';

export default class FileUploadResults extends UploadOptionsBase {
    /**
     * Constructs a new instance using the provided information.
     *
     * @param {object} options Options as provided when the direct binary object was instantiated.
     * @param {import('./direct-binary-upload-options').default} uploadOptions Options as provided
     *  when the direct binary upload process was initiated.
     */
    constructor(options, uploadOptions) {
        super(options, uploadOptions);
        this.fileLookup = {};
    }

    getTotalFileCount() {
        return Object.keys(this.fileLookup).length;
    }

    addHttpTransferOptions(transferOptions) {
        transferOptions.uploadFiles.forEach((uploadFile) => {
            const { fileUrl } = uploadFile;
            const targetPath = decodeURI(new URL(fileUrl).pathname);

            const fileInfo = { ...uploadFile };
            if (fileInfo.blob) {
                fileInfo.blob = '<provided>';
            }
            this.fileLookup[targetPath] = fileInfo;
        });
    }

    addFileEventResult(data) {
        const { targetFile } = data;
        if (this.fileLookup[targetFile]) {
            this.fileLookup[targetFile].result = data;
        }
    }

    getTotalSize() {
        return Object.keys(this.fileLookup)
            .map((file) => this.fileLookup[file].fileSize)
            .reduce((a, b) => a + b);
    }

    getAverageSize() {
        return getAverage(
            Object.keys(this.fileLookup)
                .map((file) => this.fileLookup[file].fileSize),
        );
    }

    getSuccessCount() {
        let count = 0;
        Object.keys(this.fileLookup).forEach((file) => {
            const { result } = this.fileLookup[file];
            if (result) {
                const { errors } = result;
                if (errors === undefined) {
                    count += 1;
                }
            }
        });
        return count;
    }

    getErrors() {
        let allErrors = [];
        Object.keys(this.fileLookup).forEach((file) => {
            const { result } = file;
            if (result) {
                const { errors = [] } = result;
                errors.forEach((error) => allErrors.push(error));
            }
        });
        return allErrors;
    }

    toJSON() {
        return Object.keys(this.fileLookup).map((path) => this.fileLookup[path]);
    }
}
