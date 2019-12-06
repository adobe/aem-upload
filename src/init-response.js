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

import URL from 'url';

import UploadOptionsBase from './upload-options-base';
import InitResponseFile from './init-response-file';

/**
 * Represents the response from the direct binary access initiate request.
 */
export default class InitResponse extends UploadOptionsBase {
    /**
     * Constructs a new instance of an init call response.
     *
     * @param {objects} options The options controlling the overall process.
     * @param {DirectBinaryUploadOptions} uploadOptions The options controlling the upload process.
     * @param {Array} uploadFiles List of UploadFile instances that are being uploaded.
     * @param {object} initData The raw data as provided by the init request's response.
     */
    constructor(options, uploadOptions, uploadFiles, initData) {
        super(options, uploadOptions);
        this.uploadFiles = uploadFiles;
        this.initData = initData;
    }

    /**
     * Retrieves the list of files initialized by the init request.
     *
     * @returns {Array} Information on initialized files. Each item in the array is an
     *  InitResponseFile instance.
     */
    getFiles() {
        const { files = [] } = this.initData;
        return files.map((file, index) => new InitResponseFile(
            this.getOptions(),
            this.getUploadOptions(),
            this.uploadFiles[index],
            file,
        ));
    }

    /**
     * Retrieves all the parts for all the files in the upload. The list will be grouped by
     * file, in the same order in which the files were provided to the upload process; the
     * parts themselves will be sorted in the order by which they should be uploaded.
     *
     * @returns {Array} A list of InitResponseFilePart instances.
     */
    getAllParts() {
        const parts = [];
        this.getFiles().forEach(initFile => {
            initFile.getParts().forEach(initFilePart => {
                parts.push(initFilePart);
            });
        });
        return parts;
    }

    /**
     * Retrieves the URI that can be called as-is for completing the upload process.
     *
     * @returns {string} URI to invoke for completing the upload process.
     */
    getCompleteUri() {
        let { completeURI } = this.initData;

        // older versions of the API return file-specific completeURIs. In this case, use the
        // first file's URI.
        if (!completeURI && this.getFiles().length > 0) {
            const fileCompleteURI = this.getFiles()[0].getFileData('completeURI');

            if (fileCompleteURI) {
                completeURI = fileCompleteURI;
            }
        }

        // older versions of the API return absolute URIs for the completeURI. In this case,
        // convert the URI to relative
        if (completeURI) {
            completeURI = URL.parse(completeURI).pathname;

            // remove instance context path, if necessary
            const contentIndex = completeURI.indexOf('/content/dam');
            if (contentIndex > 0) {
                completeURI = completeURI.substr(contentIndex);
            }
        }

        return `${this.getUploadOptions().getUrlPrefix()}${completeURI}`;
    }

    /**
     * Converts the class instance into a single object form containing all relevant information.
     *
     * @returns {object} Simplified view of the object's data.
     */
    toJSON() {
        return this.initData;
    }
}
