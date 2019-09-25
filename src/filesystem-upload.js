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

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import querystring from 'querystring';

import UploadBase from './upload-base';
import DirectBinaryUpload from './direct-binary-upload';
import DirectBinaryUploadOptions from './direct-binary-upload-options';

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
     * @param {object} options Controls how the upload process behaves.
     * @param {string} options.host The full host URL of the AEM instance to which the files should be uploaded. Should be
     *  everything up to before /content/dam.
     * @param {string} options.auth Will be used as the Authorization header when connecting to the instance.
     * @param {string} options.targetFolder Full, absolute path to the folder where the files should be uploaded. Should
     *  begin with /content/dam.
     * @param {Array} options.fromArr List of filesystem paths to upload. If the path is a file, the file itself will be uploaded.
     *  If the path is a directory, all files in the directory will be uploaded (not recursive).
     * @param {boolean} [options.serial] If true, the files will be uploaded one at a time. If false, files will be uploaded
     *  concurrently. Default: false.
     */
    async upload({ host, auth, targetFolder, fromArr, serial }) {
        let fileList = await this.getUploadFiles(fromArr);

        await this.createAemFolder(host, auth, targetFolder);

        // start initiate uploading, single for all files
        const directUpload = new DirectBinaryUpload(this.options);
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl(`${host}${targetFolder}`)
            .withAddContentLengthHeader(true)
            .withHeaders({ 'Authorization': auth })
            .withUploadFiles(fileList)
            .withConcurrent(!serial);

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
     * Creates a folder in AEM if it does not already exist.
     *
     * @param {*} host The full host URL of the AEM instance to which the files should be uploaded. Should be
     *  everything up to before /content/dam.
     * @param {*} auth Will be used as the Authorization header when connecting to the instance.
     * @param {*} targetFolder Full, absolute path to the folder to be created. Should
     *  begin with /content/dam.
     * @returns {Promise} Will be resolved if the folder is created successfully, otherwise will be rejected
     *  with an error.
     */
    async createAemFolder(host, auth, targetFolder) {
        const folderUrl = `${host}${targetFolder}`;

        try {
            await axios({
                url: `${folderUrl}.0.json`,
                method: 'GET',
                headers: {
                    'Authorization': auth
                }
            });
            this.logInfo(`AEM target folder '${targetFolder}' exists`);
            return;
        } catch (error) {
            this.logInfo(`AEM target folder '${targetFolder}' does not exist, create it`);
        }

        await axios({
            url: folderUrl,
            method: 'POST',
            headers: {
                'Authorization': auth
            },
            data: querystring.stringify({
                './jcr:content/jcr:title': path.basename(targetFolder),
                ':name': path.basename(targetFolder),
                './jcr:primaryType': 'sling:Folder',
                './jcr:content/jcr:primaryType': 'nt:unstructured',
                '_charset_': 'UTF-8'
            }),
        });

        this.logInfo(`AEM target folder '${targetFolder}' is created`);
    }
}
