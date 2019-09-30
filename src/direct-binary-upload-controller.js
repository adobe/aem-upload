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

/**
 * Provides various capabilities for interacting with and controlling an in-progress
 * upload.
 */
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
