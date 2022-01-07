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
const HttpTransfer = require('@adobe/httptransfer/es2015');
const mime = require('mime');

const MockHttpTransferAdapter = require('./mock-httptransfer-adapter');

const mockHttpTransfer = new MockHttpTransferAdapter(HttpTransfer);
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

/**
 * Retrieves a full URL to a target path in the mocked request framework. This URL
 * will be a path to /api/assets.
 *
 * @returns {string} Absolute URL.
 */
mock.getApiUrl = (targetPath) => {
    return `${mock.getHost()}/api/assets${targetPath}`;
};

mock.getDirectUploads = () => {
    return mockHttpTransfer.getDirectUploads();
};

const origReset = mock.reset;
let onInits = {};
let onParts = {};
let onCompletes = {};
let partSize = 512;

/**
 * Calls the default mock axios version of the method, and also resets registered part or complete
 * callback.
 */
mock.reset = function() {
    origReset.call(mock);
    onInits = {};
    mockHttpTransfer.reset();
    onParts = {};
    onCompletes = {};
    partSize = 512;
};

/**
 * Sets the size of each part for a file.
 *
 * @param {number} newSize The new part size, in bytes.
 */
mock.setPartSize = function(newSize) {
    partSize = newSize;
}

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
 * Creates an upload token to use with a given file.
 * @param {string} file The name of the file.
 * @returns {string} An upload token.
 */
mock.getUploadToken = function(file) {
    return `token_${file}`;
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
            let fileSizes = query.fileSize;

            if (typeof fileNames === 'string') {
                fileNames = [fileNames];
                fileSizes = [fileSizes];
            }
            resolve([
                201,
                {
                    completeURI: `/content/dam${decodeURI(targetFolder)}.completeUpload.json`,
                    folderPath: URL.parse(config.url).pathname,
                    files: fileNames.map((file, index) => {
                        const fileSize = fileSizes[index];
                        const numUris = Math.ceil(fileSize / partSize);
                        const uploadUris = [];

                        for (let i = 0; i < numUris; i += 1) {
                            const partUrl = mock.getPartUrl(targetFolder, file, i);
                            uploadUris.push(partUrl);

                            mock.onPut(partUrl).reply(() => processPart(partUrl));
                        }

                        return {
                            fileName: file,
                            mimeType: mime.getType(file),
                            uploadToken: mock.getUploadToken(file),
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
 * Does the work of handling the complete URI request for a CSRF token.
 *
 * @param {string} targetFolder The folder where the asset is being uploaded.
 * @param {object} options Values that were passed to the request.
 * @param {object} options.data Body passed to the request.
 */
 function returnToken() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([200, {
                "token": "fakeCSRFtoken"
            }]);
        }, 10);
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
 * Registers a mock endpoint that will return a fake csrf token
 *
 * @param {string} targetFolder Folder path.
 */
mock.addCSRF = function () {
    this.onGet(`${this.getHost()}/libs/granite/csrf/token.json`).reply(() => {
        return returnToken();
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

/**
 * Specifies that a response should be sent after a given delay.
 * Example: mock.onGet('http://localhost:4502').reply(mock.withDelay(1000, [200, 'response body']));
 * @param {number} delay The amount of time to wait, in milliseconds, before responding to a request.
 * @param {Array} response The response to provide, where the first element is the status code and
 *  the second element is the response body.
 */
mock.withDelay = (delay, response) => config => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(response);
        }, delay);
    });
};

module.exports = mock;
module.exports.mockHttpTransfer = mockHttpTransfer;
