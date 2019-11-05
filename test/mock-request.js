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
let onInits = {};
let onParts = {};
let onCompletes = {};

/**
 * Calls the default mock axios version of the method, and also resets registered part or complete
 * callback.
 */
mock.reset = function() {
    origReset.call(mock);
    onInits = {};
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
mock.getPartUrl = function(targetFolder, file, partNumber) {
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
 * Does the work of handling a part URI request.
 *
 * @param {string} partUrl The URL for the part.
 */
function processPart(partUrl) {
    const partReply = onParts[partUrl];

    if (partReply) {
        return partReply();
    }

    return new Promise(resolve => {
        setTimeout(() => {
            resolve([201]);
        }, 100);
    });
}

/**
 * Does the work of handling the initiate URI request for a folder.
 *
 * @param {string} targetFolder The folder where the asset is being uploaded.
 * @param {object} config Values that were passed to the request.
 * @param {object} config.data Body passed to the request.
 */
function processInit(targetFolder, config) {
    const result = onInits[targetFolder];

    if (result) {
        return result();
    }

    return new Promise(resolve => {
        setTimeout(() => {
            const query = querystring.parse(config.data);
            let fileNames = query.fileName;

            if (typeof fileNames === 'string') {
                fileNames = [fileNames];
            }
            resolve([
                201,
                {
                    completeURI: `/content/dam${targetFolder}.completeUpload.json`,
                    folderPath: URL.parse(config.url).pathname,
                    files: fileNames.map((file, index) => {
                        const fileSize = query.fileSize[index];
                        const numUris = Math.ceil(fileSize / 512);
                        const uploadUris = [];

                        for (let i = 0; i < numUris; i += 1) {
                            const partUrl = mock.getPartUrl(targetFolder, file, i);
                            uploadUris.push(partUrl);

                            mock.onPut(partUrl).reply(() => processPart(partUrl));
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
 * Registers a reply that will be invoked when the initiate URI for a given folder is invoked.
 *
 * @param {string} targetFolder Folder whose initiate call is being invoked.
 * @param {function} reply Function to call when the init call is made. Should return a Promise.
 */
mock.onInit = function (targetFolder, reply) {
    onInits[targetFolder] = reply;
}

/**
 * Unregisters a targetFolder whose initiate URI was registered using onInit().
 *
 * @param {string} targetFolder Folder to unregister.
 */
mock.removeOnInit = function (targetFolder) {
    if (onInits[targetFolder]) {
        delete onInits[targetFolder];
    }
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
    onParts[mock.getPartUrl(targetFolder, targetFile, partNumber)] = reply;
};

/**
 * Unregisters a part whose URI was registered using onPart().
 *
 * @param {string} targetFolder Folder where the file is being uploaded.
 * @param {string} targetFile Name of the file as it will be in the target instance.
 * @param {number} partNumber The 0-based index for the file part to reply.
 */
mock.removeOnPart = function (targetFolder, targetFile, partNumber) {
    const url = mock.getPartUrl(targetFolder, targetFile, partNumber);

    if (onParts[url]) {
        delete onParts[url];
    }
}

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
 * Unregisters a reply that was registered using onComplete().
 *
 * @param {string} targetFolder Folder where the file is being uploaded.
 * @param {string} targetFile Name of the file as it will be in the target instance.
 */
mock.removeOnComplete = function (targetFolder, targetFile) {
    const url = getFullUrl(targetFolder, targetFile);

    if (onCompletes[url]) {
        delete onCompletes[url];
    }
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
        return processInit(targetFolder, config);
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
