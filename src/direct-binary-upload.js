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
import DirectBinaryUploadProcess from './direct-binary-upload-process';

/**
 * Provides capabilities for uploading assets to an AEM instance configured with
 * direct binary access.
 */
export default class DirectBinaryUpload extends UploadBase {
    /**
     * Uploads multiple files to a target AEM instance. Through configuration,
     * supports various potential sources, including a node.js process or a
     * browser.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the upload will behave. See class
     *  documentation for more details.
     * @returns {Promise} Will be resolved when all the files have been uploaded. The data
     *  passed in successful resolution will be various statistics about the upload process.
     */
    async uploadFiles(options) {
        const uploadProcess = new DirectBinaryUploadProcess(this.getOptions(), options);

        uploadProcess.on('filestart', data => this.sendEvent('filestart', data));
        uploadProcess.on('fileprogress', data => this.sendEvent('fileprogress', data));
        uploadProcess.on('fileend', data => this.sendEvent('fileend', data));
        uploadProcess.on('fileerror', data => this.sendEvent('fileerror', data));
        uploadProcess.on('filecancelled', data => this.sendEvent('filecancelled', data));

        const controller = options.getController();

        controller.on('cancel', data => {
            uploadProcess.cancel(data);
        });

        return await uploadProcess.upload();
    }
}
