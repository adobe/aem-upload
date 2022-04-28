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

const Path = require('path');

// load .env values in the e2e folder, if any
require('dotenv').config({ path: Path.join(__dirname, '.env') });

const testutils = require('../test/testutils');

const { importFile, getTestOptions } = testutils;
const HttpClient = importFile('http/http-client');
const HttpRequest = importFile('http/http-request');

module.exports = testutils;

/**
 * Retrieves the root URL of the AEM endpoint that the test's should
 * use.
 * @returns {string} URL for an AEM instance.
 */
module.exports.getAemEndpoint = function() {
    const endpoint = process.env.AEM_ENDPOINT;

    if (!endpoint) {
        throw new Error('AEM_ENDPOINT environment variable must be supplied');
    }

    return endpoint;
}

/**
 * Updates the given options to include authentication information required
 * to communicate with AEM.
 * @param {DirectBinaryUploadOptions} uploadOptions Will be updated with auth info.
 */
module.exports.setCredentials = function(uploadOptions) {
    const basic = process.env.BASIC_AUTH;
    const token = process.env.LOGIN_TOKEN;

    if (basic) {
        return uploadOptions.withBasicAuth(basic);
    } else if (token) {
        return uploadOptions.withHeaders({
            'Cookie': token
        });
    }

    throw new Error('Either BASIC_AUTH or LOGIN_TOKEN env variable must be set');
}

/**
 * Retrieves the full URL to the folder to use when interacting with AEM.
 * @returns {string} A full URL.
 */
module.exports.getTargetFolder = function() {
    return `${module.exports.getAemEndpoint()}/content/dam/aem-upload-e2e/test_${new Date().getTime()}`;
}

/**
 * Retrieves an HTTP client that can be used to submit HTTP requests.
 * @param {DirectBinaryUploadOptions} uploadOptions Will be given as-is to the
 *  client.
 * @returns {HttpClient} A new client instance.
 */
module.exports.getHttpClient = function (uploadOptions) {
    return new HttpClient(getTestOptions(), uploadOptions);
}

/**
 * Determines whether or not a given path exists in the target AEM endpoint.
 * @param {HttpClient} httpClient Will be used to submit HTTP requests.
 * @param {DirectBinaryUploadOptions} uploadOptions The options' URL will be used
 *  when querying AEM.
 * @param {string} relativePath Relative path (from the options's URL) to the item
 *  to check. Example: /folder/myasset.jpg.
 * @returns {boolean} True if the path exists, false otherwise.
 */
module.exports.doesAemPathExist = async function(httpClient, uploadOptions, relativePath) {
    const headUrl = `${uploadOptions.getUrl().replace('/content/dam', '/api/assets')}${encodeURI(relativePath)}.json`;

    const request = new HttpRequest(getTestOptions(), headUrl)
        .withUploadOptions(uploadOptions)
        .withMethod(HttpRequest.Method.HEAD);

    try {
        await httpClient.submit(request);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * Retrieves the jcr:title property value for a given path.
 * @param {HttpClient} httpClient Will be used to submit HTTP requests.
 * @param {DirectBinaryUploadOptions} uploadOptions The options' URL will be used
 *  when querying AEM.
 * @param {string} relativePath Relative path (from the options's URL) to the item
 *  to check. Example: /folder/myasset.jpg.
 * @returns {string} Value of the path's jcr:title property, or empty string if none
 *  found.
 */
module.exports.getPathTitle = async function(httpClient, uploadOptions, relativePath) {
    const infoUrl = `${uploadOptions.getUrl().replace('/content/dam', '/api/assets')}${encodeURI(relativePath)}.json?showProperty=jcr:title`;

    const request = new HttpRequest(getTestOptions(), infoUrl)
        .withUploadOptions(uploadOptions);

    const response = await httpClient.submit(request);
    const { properties = {} } = response.getData();

    return properties['jcr:title'] || '';
}

/**
 * Deletes a path from the target AEM instance.
 * @param {HttpClient} httpClient Will be used to submit HTTP requests.
 * @param {DirectBinaryUploadOptions} uploadOptions The options' URL will be used
 *  when deleting the path.
 * @param {string} relativePath Relative path (from the options's URL) to the item
 *  to delete. Example: /folder/myasset.jpg.
 */
module.exports.deleteAemPath = async function(httpClient, uploadOptions, relativePath = '') {
    const deleteUrl = `${uploadOptions.getUrl().replace('/content/dam', '/api/assets')}${relativePath}`;

    const request = new HttpRequest(getTestOptions(), deleteUrl)
        .withUploadOptions(uploadOptions)
        .withMethod(HttpRequest.Method.DELETE);

    return httpClient.submit(request);
}

module.exports.createAemFolder = async function(httpClient, uploadOptions, folderName) {
    const createUrl = `${uploadOptions.getUrl().replace('/content/dam', `/api/assets/${encodeURIComponent(folderName)}`)}`;

    const data = JSON.stringify({
        class: 'assetFolder',
        properties: {
            title: 'Test Folder'
        }
    });
    const request = new HttpRequest(getTestOptions(), createUrl)
        .withUploadOptions(uploadOptions)
        .withMethod(HttpRequest.Method.POST)
        .withHeaders({
            'content-type': 'application/json',
        })
        .withData(data, data.length);

    return httpClient.submit(request);
}
