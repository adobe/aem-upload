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

const Path = require('path');

/**
 * Represents a directory that will be created in the target AEM
 * instance. Consist of functionality for ensuring that the
 * remote path of the folder is consistent with the configuration
 * of the upload.
 */
class FileSystemUploadDirectory {
  /**
   * Constructs a new directory instance with the given values.
   * @param {FileSystemUploadOptions} uploadOptions The URL from
   *  the options will be used to build the remote URL of the
   *  directory.
   * @param {string} localPath Full local path to the directory.
   * @param {string} remoteNodeName The name of the folder's node
   *  as it should appear in AEM.
   * @param {FileSystemUploadDirectory} [parent] Parent directory
   *  for this directory. If not supplied then the directory will
   *  be treated as the root of the upload.
   */
  constructor(uploadOptions, localPath, remoteNodeName, parent) {
    this.uploadOptions = uploadOptions;
    this.localPath = localPath;
    this.remoteName = remoteNodeName;
    this.parent = parent;
  }

  /**
   * Retrieves the full, local path of the directory, as provided in
   * the constructor.
   * @returns {string} Local directory path.
   */
  getLocalPath() {
    return this.localPath;
  }

  /**
   * Retrieves the full, remote path (only) of the item. Will be built
   * using the remote node name provided in the constructor.
   *
   * The value will not be URL encoded.
   *
   * @returns {string} Path ready for use in a URL.
   */
  getRemotePath() {
    const prefix = this.parent
      ? this.parent.getRemotePath()
      : this.uploadOptions.getTargetFolderPath();
    return `${prefix}/${this.getRemoteNodeName()}`;
  }

  /**
   * Retrieves the remote URL of the item's parent.
   * @returns {string} The item parent's URL.
   */
  getParentRemoteUrl() {
    if (!this.parentRemoteUrl) {
      const path = this.parent
        ? this.parent.getRemotePath()
        : this.uploadOptions.getTargetFolderPath();
      this.parentRemoteUrl = `${this.uploadOptions.getUrlPrefix()}${encodeURI(path)}`;
    }
    return this.parentRemoteUrl;
  }

  /**
   * Retrieves the remote node name of the item, as provided in the
   * constructor.
   * @returns {string} A node name.
   */
  getRemoteNodeName() {
    return this.remoteName;
  }

  /**
   * The name of the item as it was originally provided in the local
   * path.
   * @returns {string} Item name.
   */
  getName() {
    return Path.basename(this.localPath);
  }
}

module.exports = FileSystemUploadDirectory;
