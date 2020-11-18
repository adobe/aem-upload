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

import DirectBinaryUploadOptions from './direct-binary-upload-options';
import { DefaultValues } from './constants';

/**
 * Options specific to a file system upload. Also supports all options defined by
 * DirectBinaryUploadOptions.
 */
export default class FileSystemUploadOptions extends DirectBinaryUploadOptions {

    /**
     * Creates a new FileSystemUploadOptions instance that will have the same options
     * as an existing options instance.
     * @param {DirectBinaryUploadOptions} uploadOptions Options whose value should
     *  be copied.
     */
    static fromOptions(uploadOptions) {
        const newOptions = new FileSystemUploadOptions();
        newOptions.options = { ...uploadOptions.options };
        newOptions.controller = uploadOptions.controller;
        return newOptions;
    }

    /**
     * Sets the maximum number of files that can be uploaded using the module at one time. If
     * the total number of files exceeds this number then the library will throw an exception
     * with code TOO_LARGE.
     * @param {*} maxFileCount 
     * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
     */
    withMaxUploadFiles(maxFileCount) {
        this.options.maxUploadFiles = maxFileCount;
        return this;
    }

    /**
     * Sets a value indicating whether or not the process should upload all descendent
     * directories and files within the given directory.
     * @param {boolean} deepUpload True if the upload should be deep, false otherwise.
     * @returns {FileSystemUploadOptions} The current options instance. Allows for chaining.
     */
    withDeepUpload(deepUpload) {
        this.options.deepUpload = deepUpload;
        return this;
    }

    /**
     * Retrieves the maximum number of files that the module can upload in a single upload
     * request.
     *
     * @returns {number} Maximum file count.
     */
    getMaxUploadFiles() {
        return this.options.maxUploadFiles || DefaultValues.MAX_FILE_UPLOAD;
    }

    /**
     * Retrieves a value indicating whether the process should upload all descendent
     * directories and files within the given directory.
     * @returns {boolean} True for a deep upload, false otherwise.
     */
    getDeepUpload() {
        return !!this.options.deepUpload;
    }

}
