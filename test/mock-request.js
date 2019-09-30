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

const querystring = require('querystring');
const URL = require('url');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const mime = require('mime');

const mock = new MockAdapter(axios);

/**
 * Retrieves the host being used by the mock framework.
 *
 * @returns {string} A URL host value.
 */
mock.getHost = () => {
    return 'http://localhost';
};

/*
 * Contains a mock implementation of the Axios module, extended with some convenience methods
 * specific to the direct binary upload process.
 */

 /**
  * Retrieves a full URL to a target path in the mocked request framework.
  *
  * @returns {string} Absolute URL.
  */
mock.getUrl = (targetPath) => {
    return `${mock.getHost()}/content/dam${targetPath}`;
};

const origReset = mock.reset;
let onParts = {};
let onCompletes = {};

/**
 * Calls the default mock axios version of the method, and also resets registered part or complete
 * callback.
 */
mock.reset = function() {
    origReset.call(mock);
    onParts = {};
    onCompletes = {};
};

/**
 * Retrieves the full URL to a file part in the mocked request framework.
 *
 * @param {string} targetFolder The folder where the file is being uploaded.
 * @param {string} file The name of the file being uploaded.
 * @param {number} partNumber The part number being uploaded.
 * @returns {string} A full URL.
 */
function getPartUrl(targetFolder, file, partNumber) {
    return mock.getUrl(`${targetFolder}/${file}.${partNumber}`);
}

/**
 * Retrieves the full URL to a path in the mocked request framework.
 *
 * @param {string} targetFolder The folder to include in the URL.
 * @param {string} file The name of the file to include in the URL.
 * @returns {string} A full URL.
 */
function getFullUrl(targetFolder, file) {
    return mock.getUrl(`${targetFolder}/${file}`);
}

/**
 * Does the work of handling the complete URI request for a file.
 *
 * @param {string} targetFolder The folder where the asset is being uploaded.
 * @param {object} options Values that were passed to the request.
 * @param {object} options.data Body passed to the request.
 */
function processComplete(targetFolder, options) {
    const { fileName } = querystring.parse(options.data);

    const fullUrl = getFullUrl(targetFolder, fileName);
    const result = onCompletes[fullUrl];

    if (result) {
        return result();
    }

    return new Promise(resolve => {
        setTimeout(() => {
            resolve([201]);
        }, 100);
    });
}

/**
 * Registers a reply that will be invoked when a given part of a given file is uploaded.
 *
 * @param {string} targetFolder Folder where the file is being uploaded.
 * @param {string} targetFile Name of the file as it will be in the target instance.
 * @param {number} partNumber The 0-based index for the file part to reply.
 * @param {function} reply Function to call when the matching part is uploaded. Should return a Promise.
 */
mock.onPart = function (targetFolder, targetFile, partNumber, reply) {
    onParts[getPartUrl(targetFolder, targetFile, partNumber)] = reply;
};

/**
 * Registers a reply that will be invoked when the complete URI for a given file is invoked.
 *
 * @param {string} targetFolder Folder where the file is being uploaded.
 * @param {string} targetFile Name of the file as it will be in the target instance.
 * @param {function} reply Function to call when the complete URI for the matching file is invoked. Should return a Promise.
 */
mock.onComplete = function (targetFolder, targetFile, reply) {
    onCompletes[getFullUrl(targetFolder, targetFile)] = reply;
}

/**
 * Registers a mock folder that will be able to accept direct binary uploads. This will register mock requests
 * for the initiateUpload servlet, file part URIs, and completeUpload servlet.
 *
 * @param {string} targetFolder Folder path.
 */
mock.addDirectUpload = function (targetFolder) {
    const fullUrl = this.getUrl(targetFolder);
    this.onPost(`${fullUrl}.initiateUpload.json`).reply(config => {
        return new Promise(resolve => {
            setTimeout(() => {
                const query = querystring.parse(config.data);
                resolve([
                    201,
                    {
                        completeURI: `/content/dam${targetFolder}.completeUpload.json`,
                        folderPath: URL.parse(config.url).pathname,
                        files: query.fileName.map((file, index) => {
                            const fileSize = query.fileSize[index];
                            const numUris = Math.ceil(fileSize / 512);
                            const uploadUris = [];

                            for (let i = 0; i < numUris; i += 1) {
                                const partUrl = getPartUrl(targetFolder, file, i);
                                const partReply = onParts[partUrl];
                                uploadUris.push(partUrl);

                                if (partReply) {
                                    this.onPut(partUrl).reply(partReply);
                                } else {
                                    this.onPut(partUrl).reply(() => {
                                        return new Promise(resolve => {
                                            setTimeout(() => {
                                                resolve([201]);
                                            }, 100);
                                        });
                                    });
                                }
                            }

                            return {
                                fileName: file,
                                mimeType: mime.getType(file),
                                uploadToken: `token_${file}`,
                                uploadURIs: uploadUris,
                                minPartSize: 256,
                                maxPartSize: 1024,
                            }
                        }),
                    },
                ]);
            }, 100);
        });
    });

    this.onPost(`${fullUrl}.completeUpload.json`).reply(options => {
        return processComplete(targetFolder, options);
    });
};

/**
 * Retrieves all files that were uploaded using the mock request framework.
 *
 * @returns {object} Simple object whose keys are full file paths, and values are the data for each file.
 */
mock.getDirectFiles = function () {
    const puts = this.history.put;
    should(puts.length).be.exactly(6);

    const files = {};
    for (let i = 0; i < puts.length; i += 1) {
        let filePath = String(URL.parse(puts[i].url).pathname);
        filePath = filePath.substr(0, filePath.lastIndexOf('.'));
        if (!files[filePath]) {
            files[filePath] = '';
        }
        files[filePath] += puts[i].data.mockData;
    }

    return files;
}

module.exports = mock;
