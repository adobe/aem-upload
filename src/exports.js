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

import DirectBinaryUploadImport from './direct-binary-upload';
import DirectBinaryUploadOptionsImport from './direct-binary-upload-options';
import DirectBinaryUploadErrorCodesImport from './error-codes';
import FileSystemUploadImport from './filesystem-upload';
import FileSystemUploadOptionsImport from './filesystem-upload-options';

export default {
    DirectBinaryUpload: DirectBinaryUploadImport,
    DirectBinaryUploadOptions: DirectBinaryUploadOptionsImport,
    DirectBinaryUploadErrorCodes: DirectBinaryUploadErrorCodesImport,
    FileSystemUpload: FileSystemUploadImport,
    FileSystemUploadOptions: FileSystemUploadOptionsImport,
}

export const DirectBinaryUpload = DirectBinaryUploadImport;
export const DirectBinaryUploadOptions = DirectBinaryUploadOptionsImport;
export const DirectBinaryUploadErrorCodes = DirectBinaryUploadErrorCodesImport;
export const FileSystemUpload = FileSystemUploadImport;
export const FileSystemUploadOptions = FileSystemUploadOptionsImport;
