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
     *  passed in successful resolution will be an instance of UploadResult.
     */
    async uploadFiles(options) {
        const uploadProcess = new DirectBinaryUploadProcess(this.getOptions(), options);

        uploadProcess.on('filestart', data => this.sendEvent('filestart', data));
        uploadProcess.on('fileprogress', data => this.sendEvent('fileprogress', data));
        uploadProcess.on('fileend', data => this.sendEvent('fileend', data));
        uploadProcess.on('fileerror', data => this.sendEvent('fileerror', data));
        uploadProcess.on('filecancelled', data => this.sendEvent('filecancelled', data));

        return await uploadProcess.upload();
    }
}
