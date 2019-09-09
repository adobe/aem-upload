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
     * Retrieves the URI that can be called as-is for completing the upload process.
     *
     * @returns {string} URI to invoke for completing the upload process.
     */
    getCompleteUri() {
        const { completeURI } = this.initData;

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
