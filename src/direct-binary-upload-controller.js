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

export default class DirectBinaryUploadController extends UploadBase {
    /**
     * Instructs the upload to cancel the entire upload process.
     */
    cancel() {
        this.sendEvent('cancel', {});
    }

    /**
     * Instructs the upload to cancel a specific file upload.
     */
    cancelFile(fileName) {
        this.sendEvent('cancel', { fileName });
    }
}
