/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * Represents an asset that will be created in the target AEM
 * instance. Consist of functionality for ensuring that the
 * remote path of the asset is consistent with the configuration
 * of the upload.
 */

const FileSystemUploadDirectory = require('./filesystem-upload-directory');

class FileSystemUploadAsset extends FileSystemUploadDirectory {
  /**
   * Constructs a new instance of the class using the given values.
   * @param {FileSystemUploadOptions} uploadOptions URL of the options
   *  will be used to build the asset's remote path.
   * @param {string} localPath Full path to the local asset.
   * @param {string} remoteNodeName Name of the asset's node as it should
   *  appear in AEM.
   * @param {number} size Size, in bytes, of the asset.
   * @param {FileSystemUploadDirectory} [directory] If provided, the
   *  directory to which the asset belongs. If not provided then the
   *  asset will be treated as the root.
   */
  constructor(uploadOptions, localPath, remoteNodeName, size, directory) {
    super(uploadOptions, localPath, remoteNodeName, directory);
    this.size = size;
  }

  /**
   * Retrieves the size of the asset, as provided in the constructor.
   * @returns {number} Size in bytes.
   */
  getSize() {
    return this.size;
  }
}

module.exports = FileSystemUploadAsset;
