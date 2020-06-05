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

import fs from 'fs';
import path from 'path';
import axios from 'axios';

import UploadBase from './upload-base';
import DirectBinaryUpload from './direct-binary-upload';
import { trimContentDam } from './utils';

/**
 * Promise-ified version of fs.stat().
 *
 * @param {string} path Path to the item to stat.
 * @returns {Promise} Resolved with the item's stat information, or rejected with
 *  an error.
 */
function statPromise(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stat) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stat);
        });
    });
}

/**
 * Promise-ified version of fs.readdir().
 *
 * @param {string} path Path to the directory to read.
 * @returns {Promise} Resolved with a list of item names in the directory, or rejected with an error.
 */
function readDirPromise(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, results) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(results);
        });
    });
}

/**
 * Uploads one or more files from the local file system to a target AEM instance using direct binary access.
 */
export default class FileSystemUpload extends UploadBase {
    /**
     * Retrieves information from the local file system for a list of files, creates a new directory in
     * AEM, then uploads each of the local files to the new directory using direct binary access.
     *
     * @param {DirectBinaryUploadOptions} options Controls how the upload process behaves.
     * @param {Array} localPaths List of local paths to upload. If a path is a directory then its
     *  files will be retrieved and added to the upload.
     * @returns {Promise} Will be resolved when all the files have been uploaded. The data
     *  passed in successful resolution will be an instance of UploadResult.
     */
    async upload(options, localPaths) {
        await this.createAemFolderStructure(options);

        // start initiate uploading, single for all files
        const directUpload = new DirectBinaryUpload(this.options);
        const uploadOptions = options
            .withAddContentLengthHeader(true)
            .withUploadFiles(await this.getUploadFiles(localPaths));

        return await directUpload.uploadFiles(uploadOptions);
    }

    /**
     * Retrieves a flat list of files based on file paths. If a path is a file it will be added to the returned array.
     * If a path is a directory then all files immediately beneath the directory will be added to the returned array.
     *
     * @param {Array} fromArr List of local file system paths.
     * @returns {Promise} Will be resolved with an array containing a flat list of simple objects ready to be passed to the
     *  constructor of UploadFile.
     */
    async getUploadFiles(fromArr) {
        let fileList = [];

        for (let i = 0; i < fromArr.length; i += 1) {
            const item = fromArr[i];
            let fileStat;

            try {
                fileStat = await statPromise(item);
            } catch (e) {
                this.logWarn(`The specified '${item}' doesn't exists`);
            }

            if (fileStat) {
                if (fileStat.isFile()) {
                    let fileName = path.basename(item);
                    let fileSize = fileStat.size;
                    fileList.push({
                        fileName,
                        filePath: item,
                        fileSize,
                    });
                } else if (fileStat.isDirectory()) {
                    let subFileArr = await readDirPromise(item);

                    for (let d = 0; d < subFileArr.length; d += 1) {
                        const fileName = subFileArr[d];
                        let filePath = path.join(item, fileName);
                        let subFileStat = await statPromise(filePath);
                        if (subFileStat.isFile()) {
                            if (fileName.match(/^\./)) {
                                this.logDebug('Skip hidden file: ' + fileName);
                            } else {
                                let fileSize = subFileStat.size;
                                fileList.push({
                                    fileName: fileName,
                                    filePath: filePath,
                                    fileSize: fileSize
                                });
                            }
                        } else {
                            this.logDebug('Skip non file: ' + fileName);
                        }
                    }
                }
            }
        }

        this.logInfo('Local files for uploading: ' + JSON.stringify(fileList, null, 4));
        return fileList;
    }

    /**
     * Creates a folder and all of its parents if they do not already exist.
     * @param {DirectBinaryUploadOptions} options Options controlling how the upload process behaves.
     * @returns {Promise} Will be resolved if the folders are created successfully, otherwise will be
     *  rejected with an error.
     */
    async createAemFolderStructure(options) {
        const targetFolder = options.getTargetFolderPath();
        const trimmedFolder = trimContentDam(targetFolder);

        if (trimmedFolder) {
            let currPath = '/content/dam';
            const paths = String(trimmedFolder).split('/').filter(e => e.length);

            for (let i = 0; i < paths.length; i += 1) {
                currPath += `/${paths[i]}`;
                await this.createAemFolder(options, currPath);
            }
            
        }
    }

    /**
     * Creates a folder in AEM if it does not already exist.
     *
     * @param {DirectBinaryUploadOptions} options Options controlling how the upload process behaves.
     * @param {string} [folderPath] If specified, the path of the folder to create. If not specified, the
     *  target folder in the provided options will be used.
     * @returns {Promise} Will be resolved if the folder is created successfully, otherwise will be rejected
     *  with an error.
     */
    async createAemFolder(options, folderPath = '') {
        const targetFolder = folderPath ? folderPath : options.getTargetFolderPath();
        const headers = options.getHeaders();
        const trimmedFolder = trimContentDam(targetFolder);

        if (trimmedFolder) {
            const folderName = path.basename(trimmedFolder);
            try {
                await axios({
                    url: `${options.getUrlPrefix()}/api/assets${trimmedFolder}`,
                    method: 'POST',
                    headers,
                    data: {
                        class: 'assetFolder',
                        properties: {
                            title: folderName
                        }
                    }
                });
            } catch (e) {
                let rethrow = true;
                if (e) {
                    const { response = {} } = e;
                    const { status } = response;

                    if (status === 409) {
                        rethrow = false;
                        this.logInfo(`AEM target folder '${targetFolder}' already exists`);
                    }
                }

                if (rethrow) {
                    throw e;
                }
            }
        }

        this.logInfo(`AEM target folder '${targetFolder}' is created`);
    }
}
