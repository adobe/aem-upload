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

const Path = require('path');
const fs = require('./fs-promise');

const DirectBinaryUpload = require('./direct-binary-upload');
const DirectBinaryUploadProcess = require('./direct-binary-upload-process');
const FileSystemUploadOptions = require('./filesystem-upload-options');
const {
  trimContentDam,
  walkDirectory,
  isTempPath,
} = require('./utils');
const {
  submitRequest,
} = require('./http-utils');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');
const UploadResult = require('./upload-result');
const {
  isDeepUpload,
  getMaxFileCount,
} = require('./filesystem-upload-utils');
const FileSystemUploadItemManager = require('./filesystem-upload-item-manager');
const CreateDirectoryResult = require('./create-directory-result');
const { HttpMethods } = require('./constants');

/**
 * Uploads one or more files from the local file system to a target AEM instance using direct
 * binary access.
 */
class FileSystemUpload extends DirectBinaryUpload {
  /**
   * Retrieves information from the local file system for a list of files, creates a new directory
   * in AEM, then uploads each of the local files to the new directory using direct binary access.
   *
   * @param {import('./direct-binary-upload-options')} options Controls how the upload process
   *  behaves.
   * @param {Array<string>} localPaths List of local paths to upload. If a path is a directory
   *  then its files will be retrieved and added to the upload.
   * @returns {Promise} Will be resolved when all the files have been uploaded. The data
   *  passed in successful resolution will be an UploadResult as JSON.
   */
  async upload(options, localPaths) {
    const fileSystemUploadOptions = FileSystemUploadOptions.fromOptions(options);
    const uploadOptions = this.getOptions();
    const uploadResult = new UploadResult(uploadOptions, fileSystemUploadOptions);
    await this.createTargetFolder(fileSystemUploadOptions, uploadResult);
    const {
      directories,
      files,
      errors,
      totalSize,
    } = await this.getUploadInformation(fileSystemUploadOptions, localPaths);

    this.logInfo(`From ${localPaths.length} paths, filesystem upload compiled upload of ${directories.length} directories, ${files.length} files, with a total size of ${totalSize}. Encountered ${errors.length} filesystem-related errors.`);

    const uploadFiles = this.convertToUploadFilesWithUrl(fileSystemUploadOptions, files);

    // initiate the upload process
    const fileUploadOptions = FileSystemUploadOptions.fromOptions(fileSystemUploadOptions)
      .withUploadFiles(uploadFiles);

    const uploadProcess = new DirectBinaryUploadProcess(
      this.getOptions(),
      fileUploadOptions,
    );

    this.beforeUploadProcess(uploadProcess, directories.length);
    await this.createUploadDirectories(
      fileSystemUploadOptions,
      uploadResult,
      directories,
    );

    if (uploadFiles.length) {
      this.logInfo(`Uploading ${uploadFiles.length} files`);

      await this.executeUploadProcess(uploadProcess, uploadResult);
    } else {
      this.logInfo('No files found in provided paths, skipping upload.');
    }

    this.afterUploadProcess(uploadProcess, uploadResult, directories.length);

    // we have a list of multiple results (for each directory upload). Merge all those
    // into a single result that contains metrics for the overall upload of all
    // directories and files.
    return uploadResult.toJSON();
  }

  /**
   * Converts a list of FileSystemUploadAsset instances to a list of UploadFile items, ready
   * for use in upload options.
   * @param {FileSystemUploadOptions} options Options for the upload.
   * @param {Array<import('./filesystem-upload-asset')>} files List of FileSystemUploadAsset
   *  instances.
   * @returns {Array} List of files ready for use with DirectBinaryUploadOptions.withUploadFiles().
   */
  // eslint-disable-next-line class-methods-use-this
  convertToUploadFiles(options, files) {
    const fileList = [];

    files.forEach((file) => {
      fileList.push({
        ...options.getUploadFileOptions(),
        fileName: file.getRemoteNodeName(),
        filePath: file.getLocalPath(),
        fileSize: file.getSize(),
      });
    });

    return fileList;
  }

  /**
   * Converts a list of FileSystemUploadAsset instances to a list of UploadFile items, ready
   * for use in upload options. The file options generated by this method will include a
   * "fileUrl" property instead of a "fileName" property.
   * @param {import('./direct-binary-upload-options')} options Options controlling the upload.
   * @param {Array<import('./filesystem-upload-asset')>} files List of FileSystemUploadAsset
   *  instances.
   * @returns {Array} List of files ready for use with DirectBinaryUploadOptions.withUploadFiles().
   */
  // eslint-disable-next-line class-methods-use-this
  convertToUploadFilesWithUrl(options, files) {
    const fileList = [];

    files.forEach((file) => {
      fileList.push({
        ...options.getUploadFileOptions(),
        fileUrl: `${file.getParentRemoteUrl()}/${encodeURIComponent(file.getRemoteNodeName())}`,
        filePath: file.getLocalPath(),
        fileSize: file.getSize(),
      });
    });

    return fileList;
  }

  /**
   * Iterates over a list of local paths provided to the upload. If a path is a file, it will
   * be added to a master list of all paths to upload. If a path is a directory, the method
   * will (recursively) iterate over all descendent directories and files in the path and add
   * them to the master list of paths to upload.
   * @param {import('./direct-binary-upload-options')} options Controls how the upload behaves.
   *  Will be used to determine the maximum number of files to upload.
   * @param {Array<string>} localPaths List of local paths to iterate.
   * @returns {object} Aggregated information about all paths to be included in the upload. Has
   *  the following elements:
   *  * {Array} directories: List of full paths to all directories included in the upload.
   *  * {Array} files: List of full paths to all files included in the upload.
   *  * {Array} errors: List of any errors that occurred during processing, which may result in
   *    some paths being excluded from the final result.
   *  * {number} totalSize: Size, in bytes, of all files included in the upload.
   *  * {boolean} isDirectory: True if the path is a directory, false otherwise.
   */
  // eslint-disable-next-line class-methods-use-this
  async getUploadInformation(options, localPaths) {
    let allFiles = [];
    let allDirectories = [];
    let allErrors = [];
    let allTotalSize = 0;
    const isDeep = isDeepUpload(options);

    for (let i = 0; i < localPaths.length; i += 1) {
      const currPath = localPaths[i];
      if (!isTempPath(currPath)) {
        let stat = false;

        try {
          // eslint-disable-next-line no-await-in-loop
          stat = await fs.stat(localPaths[i]);
        } catch (e) {
          allErrors.push(e);
          // eslint-disable-next-line no-continue
          continue;
        }
        if (stat.isDirectory()) {
          const {
            directories,
            files,
            errors,
            totalSize,
          // eslint-disable-next-line no-await-in-loop
          } = await walkDirectory(currPath, getMaxFileCount(options), isDeep);
          const itemManager = new FileSystemUploadItemManager(options, currPath, !isDeep);
          if (isDeep) {
            // directories only need to be included for deep uploads
            // eslint-disable-next-line no-await-in-loop
            allDirectories.push(await itemManager.getDirectory(currPath));
            const subDirectories = [];
            for (let directoryIndex = 0; directoryIndex < directories.length; directoryIndex += 1) {
              const { path: dirPath } = directories[directoryIndex];
              // eslint-disable-next-line no-await-in-loop
              subDirectories.push(await itemManager.getDirectory(dirPath));
            }
            allDirectories = allDirectories.concat(subDirectories);
          }
          const subAssets = [];
          for (let assetIndex = 0; assetIndex < files.length; assetIndex += 1) {
            const { path: filePath, size: fileSize } = files[assetIndex];
            // eslint-disable-next-line no-await-in-loop
            subAssets.push(await itemManager.getAsset(filePath, fileSize));
          }
          allFiles = allFiles.concat(subAssets);
          allErrors = allErrors.concat(errors);
          allTotalSize += totalSize;
        } else if (stat.isFile()) {
          const itemManager = new FileSystemUploadItemManager(options, currPath);
          // eslint-disable-next-line no-await-in-loop
          allFiles.push(await itemManager.getAsset(currPath, stat.size));
          allTotalSize += stat.size;
        }
      }

      const maxFileCount = getMaxFileCount(options);
      if (allFiles.length > maxFileCount) {
        throw new UploadError(`File system upload has exceeded maximum of ${maxFileCount} allowed files`, ErrorCodes.TOO_LARGE);
      }
    }

    return {
      directories: allDirectories,
      files: allFiles,
      errors: allErrors,
      totalSize: allTotalSize,
    };
  }

  /**
   * Given path information for a local path upload, creates all the directories required to
   * complete the upload. The method will iterate all of the paths in the given information,
   * create the path itself if it's a directory, and create all of of descendent directories.
   * @param {import('./direct-binary-upload-options')} options Target folder information used
   *  to determine location where directories should be created.
   * @param {UploadResult} uploadResult Statistics about the upload process.
   * @param {Array} directories An array of FileSystemUploadDirectory instances for the
   *  directories to be created.
   */
  async createUploadDirectories(options, uploadResult, directories) {
    for (let i = 0; i < directories.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.createAemFolderFromFileSystemInfo(
        options,
        uploadResult,
        directories[i],
      );
    }
  }

  /**
   * Creates the target folder from upload options and all of its parents if they do not already
   * exist.
   * @param {import('./direct-binary-upload-options')} options Options controlling how the upload
   *  process behaves.
   * @param {UploadResult} uploadResult Various statistics about the upload operation.
   * @returns {Promise} Will be resolved if the folders are created successfully, otherwise will be
   *  rejected with an error.
   */
  async createTargetFolder(options, uploadResult) {
    const targetFolder = options.getTargetFolderPath();
    const trimmedFolder = trimContentDam(targetFolder);

    if (trimmedFolder) {
      let currPath = '/content/dam';
      const paths = String(trimmedFolder).split('/').filter((e) => e.length);

      for (let i = 0; i < paths.length; i += 1) {
        currPath += `/${paths[i]}`;
        // eslint-disable-next-line no-await-in-loop
        await this.createAemFolder(options, uploadResult, currPath);
      }
    }
  }

  /**
   * Creates a folder in AEM if it does not already exist.
   *
   * @param {import('./direct-binary-upload-options')} options Options controlling how the upload
   *  process behaves.
   * @param {UploadResult} uploadResult Statistics about the upload process.
   * @param {FileSystemUploadDirectory} uploadDirectory Information about the directory
   *  to be created. The instance's remote URL will be used for creation.
   * @returns {Promise} Will be resolved if the folder is created successfully, otherwise will be
   *  rejected with an error.
   */
  async createAemFolderFromFileSystemInfo(options, uploadResult, uploadDirectory) {
    return this.createAemFolder(
      options,
      uploadResult,
      uploadDirectory.getRemotePath(),
      uploadDirectory.getName(),
    );
  }

  /**
   * Creates a folder in AEM if it does not already exist.
   *
   * @param {import('./direct-binary-upload-options')} options Options controlling how the upload
   *  process behaves.
   * @param {UploadResult} uploadResult Statistics about the upload process.
   * @param {string} [folderPath] If specified, the path of the folder to create. If not specified,
   *  the target folder in the provided options will be used.
   * @param {string} [folderTitle] If specified, the value to use as the title of the folder. If not
   *  specified then the value will be derived from the folder's path.
   * @returns {Promise} Will be resolved if the folder is created successfully, otherwise will be
   *  rejected with an error.
   */
  async createAemFolder(options, uploadResult, folderPath = '', folderTitle = '') {
    const targetFolder = folderPath || options.getTargetFolderPath();
    const trimmedFolder = trimContentDam(targetFolder);

    if (trimmedFolder) {
      const folderName = folderTitle || Path.basename(trimmedFolder);
      const createResult = new CreateDirectoryResult(
        this.getOptions(),
        options,
        targetFolder,
        folderName,
      );
      try {
        this.logInfo(`Creating AEM directory ${folderPath} with title '${folderTitle}'`);
        const createUrl = `${options.getUrlPrefix()}/api/assets${encodeURI(trimmedFolder)}`;
        const { headers: optionHeaders = {} } = options.getHttpOptions();
        const requestOptions = {
          ...options.getHttpOptions(),
          headers: {
            ...optionHeaders,
            'Content-Type': 'application/json',
          },
          method: HttpMethods.POST,
          body: JSON.stringify({
            class: 'assetFolder',
            properties: {
              'jcr:title': folderName,
            },
          }),
        };
        const response = await submitRequest(createUrl, requestOptions);
        if (!response.ok) {
          throw UploadError.fromError({
            response,
            stack: new Error().stack,
          });
        }
        createResult.setCreateResponse(response);
        this.logInfo(`AEM folder '${targetFolder}' is created`);
        this.emit('foldercreated', {
          folderName,
          targetParent: Path.dirname(targetFolder).replaceAll(/\\/g, '/'),
          targetFolder,
        });
      } catch (e) {
        const uploadError = UploadError.fromError(e);
        createResult.setCreateError(uploadError);
        if (uploadError.code === ErrorCodes.ALREADY_EXISTS) {
          this.logInfo(`AEM folder '${targetFolder}' already exists`);
        } else {
          throw uploadError;
        }
      }
      uploadResult.addCreateDirectoryResult(createResult);
    }
  }
}

module.exports = FileSystemUpload;
