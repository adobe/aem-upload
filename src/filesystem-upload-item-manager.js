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

const { normalizePath } = require('./utils');
const FileSystemUploadDirectory = require('./filesystem-upload-directory');
const FileSystemUploadAsset = require('./filesystem-upload-asset');
const {
  cleanFolderName,
  cleanAssetName,
  getItemManagerParent,
} = require('./filesystem-upload-utils');

/**
 * Keeps track of FileSystemUploadDirectory and FileSystemUploadAsset
 * instances that have been retrieved using the manager. Its primary
 * purpose is to ensure that an instance for any given path is only
 * created once, then reused thereafter. It will also automatically
 * create necessary instances for parent directories up until the
 * manager's root path.
 */
class FileSystemUploadItemManager {
  /**
   * Constructs a new, empty instance of the manager that will use
   * a the given information.
   * @param {FileSystemUploadOptions} uploadOptions Will be given to
   *  each FileSystemUploadDirectory instance that is created.
   * @param {string} rootPath The top-most path that the manager
   *  will track.
   * @param {boolean} [keepFlat] If true, assets retrieved through
   *  the item manager will be kept at the root of the upload instead
   *  of inside its parent directory. Default: false.
   */
  constructor(uploadOptions, rootPath, keepFlat = false) {
    this.uploadOptions = uploadOptions;
    this.directories = new Map();
    this.assets = new Map();
    this.rootPath = normalizePath(rootPath);
    this.keepFlat = keepFlat;
  }

  /**
   * Retrieves an instance of FileSystemUploadDirectory for a given local path.
   * The method will cache the instance, if necessary, and will also ensure that
   * all parent instances up to the manager's root are also cached.
   * @param {string} localPath Directory path whose information will be used
   *  to create the FileSystemUploadDirectory instance.
   * @returns {Promise} Resolved with a FileSystemUploadDirectory instance
   *  representing of the given directory path.
   */
  async getDirectory(localPath) {
    const normalizedPath = normalizePath(localPath);
    const parent = await getItemManagerParent(this, this.rootPath, localPath);

    if (!this.directories.has(normalizedPath)) {
      const nodeName = await cleanFolderName(this.uploadOptions, Path.basename(normalizedPath));
      this.directories.set(
        normalizedPath,
        new FileSystemUploadDirectory(
          this.uploadOptions,
          normalizedPath,
          nodeName,
          parent,
        ),
      );
    }

    return this.directories.get(normalizedPath);
  }

  /**
   * Retrieves an instance of FileSystemUploadAsset for a given local path.
   * The method will cache the instance, if necessary, and will also ensure that
   * all parent instances up to the manager's root are also cached.
   * @param {string} localPath Asset path whose information will be used
   *  to create the FileSystemUploadAsset instance.
   * @param {number} size Size, in bytes, of the asset.
   * @returns {Promise} Resolved with a FileSystemUploadAsset instance
   *  representing of the given asset path.
   */
  async getAsset(localPath, size) {
    const normalizedPath = normalizePath(localPath);
    const parent = !this.keepFlat
      ? await getItemManagerParent(this, this.rootPath, localPath)
      : undefined;

    if (!this.assets.has(normalizedPath)) {
      const nodeName = await cleanAssetName(this.uploadOptions, Path.basename(normalizedPath));
      this.assets.set(
        normalizedPath,
        new FileSystemUploadAsset(
          this.uploadOptions,
          normalizedPath,
          nodeName,
          size,
          parent,
        ),
      );
    }

    return this.assets.get(normalizedPath);
  }

  /**
   * Retrieves a value indicating whether the given local directory path
   * has been cached in the manager.
   * @param {string} localPath Full path to a local directory.
   * @returns {boolean} True if the directory is cached, false otherwise.
   */
  hasDirectory(localPath) {
    return this.directories.has(normalizePath(localPath));
  }

  /**
   * Retrieves a value indicating whether the given local asset path
   * has been cached in the manager.
   * @param {string} localPath Full path to a local asset.
   * @returns {boolean} True if the asset is cached, false otherwise.
   */
  hasAsset(localPath) {
    return this.assets.has(normalizePath(localPath));
  }
}

module.exports = FileSystemUploadItemManager;
