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

import UploadBase from './upload-base';

/**
 * Common base class for all classes that work with a DirectBinaryUploadOptions
 * instance.
 */
export default class UploadOptionsBase extends UploadBase {
    /**
     * Constructs a new instance using the provided information.
     *
     * @param {object} options Options as provided when the direct binary object was instantiated.
     * @param {DirectBinaryUploadOptions} uploadOptions Options as provided when the direct binary upload process was initiated.
     */
    constructor(options, uploadOptions) {
        super(options);
        this.uploadOptions = uploadOptions;
    }

    /**
     * Retrieves the upload options that were provided when the upload was initiated.
     *
     * @returns {DirectBinaryUploadOptions} Upload options.
     */
    getUploadOptions() {
        return this.uploadOptions;
    }
}
