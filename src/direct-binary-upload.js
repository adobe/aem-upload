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
import UploadResult from './upload-result';

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
    const uploadResult = new UploadResult(this.getOptions(), options);

    this.beforeUploadProcess(uploadProcess);
    await this.executeUploadProcess(uploadProcess, uploadResult);
    this.afterUploadProcess(uploadProcess, uploadResult);

    return uploadResult.toJSON();
  }

  /**
   * Determines whether a given upload can be performed. If the upload is not possible then
   * the method will throw an UploadError whose code specifies the reason why the upload
   * cannot happen.
   * @param {DirectBinaryUploadOptions} options Options for the proposed upload. See module
   *  documentation for details.
   */
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async canUpload(options) {
    // this is a legacy option, but leaving the method in place for backward compatibility.
    // The library previously only worked if direct binary upload was enabled on AEM. However,
    // the capabilities of node-httptransfer were updated so that it could upload using the
    // create asset servlet if direct binary upload is not available. So the upload process
    // will now work with any AEM instance, regardless of its configuration
    return true;
  }
}
