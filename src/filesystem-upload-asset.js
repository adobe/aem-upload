/*
Copyright 2020 Adobe. All rights reserved.
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
export default class FileSystemUploadAsset {
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
        this.uploadOptions = uploadOptions;
        this.localPath = localPath;
        this.remoteName = remoteNodeName;
        this.size = size;
        this.directory = directory;
    }

    /**
     * Retrieves the full, local path of the asset, as provided in
     * the constructor.
     * @returns {string} Local asset path.
     */
    getLocalPath() {
        return this.localPath;
    }

    /**
     * Retrieves the full, remote path (only) of the asset. Will be built
     * using the remote node name provided in the constructor.
     * @returns {string} Path ready for use in a URL.
     */
    getRemotePath() {
        let prefix = this.directory ? this.directory.getRemotePath() : this.uploadOptions.getTargetFolderPath();
        return `${prefix}/${this.getRemoteNodeName()}`;
    }

    /**
     * Retrieves the remote URL of the asset's parent.
     * @returns {string} The asset parent's URL.
     */
    getParentRemoteUrl() {
        const path = this.directory ? this.directory.getRemotePath() : this.uploadOptions.getTargetFolderPath();
        return `${this.uploadOptions.getUrlPrefix()}${path}`;
    }

    /**
     * Retrieves the remote node name of the asset, as provided in the
     * constructor.
     * @returns {string} A node name.
     */
    getRemoteNodeName() {
        return this.remoteName;
    }

    /**
     * Retrieves the size of the asset, as provided in the constructor.
     * @returns {number} Size in bytes.
     */
    getSize() {
        return this.size;
    }
}
