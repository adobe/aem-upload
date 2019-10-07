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

import URL from 'url';

import DirectBinaryUploadController from './direct-binary-upload-controller';
import { DefaultValues } from './constants';

/**
 * Options that generally control how a direct binary upload will behave. The class contains
 * several optional configurations, but the minimal setup will require at least the following:
 *
 * ```js
 * const options = new DirectBinaryUploadOptions()
 *  .withUrl(uploadTargetUrl) // URL of the target of the upload
 *  .withUploadFiles(fileList) // list of files to upload
 * ```
 *
 * All other options are optional.
 */
export default class DirectBinaryUploadOptions {
    constructor() {
        this.options = {
            maxConcurrent: DefaultValues.MAX_CONCURRENT,
            headers: {},
        };
        this.controller = new DirectBinaryUploadController();
    }

    /**
     * Sets the URL to which binaries will be uploaded. The URL should include the path to
     * a directory. Depending on the context, this could be either a relative or absolute URL.
     * For example, running from a node.js process will require an absolute URL, whereas running
     * from a browser will allow relative URLs.
     *
     * @param {string} url The URL to which binaries will be uploaded.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withUrl(url) {
        this.options.url = url;
        return this;
    }

    /**
     * An array of object instances representing the files that will be uploaded
     * to the target URL.
     *
     * @param {Array} uploadFiles Files to upload to the target. Each file must contain
     *  at least the following properties: fileName, fileSize, and either filePath OR blob.
     *  See UploadFile for more information.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withUploadFiles(uploadFiles) {
        this.options.uploadFiles = uploadFiles;
        return this;
    }

    /**
     * If specified, an object containing headers that will be sent along with each
     * request submitted to the target.
     *
     * The given headers will be merged with any headers specified previously using
     * the method.
     *
     * @param {object} headers Keys should be header names, values should be the header's value.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withHeaders(headers) {
        this.options.headers = {
            ...this.options.headers,
            ...headers,
        };
        return this;
    }

    /**
     * Convenience method that adds a basic Authorization header that will be submitted
     * to the target.
     *
     * @param {string} basicAuth Basic authorization value in the form of username:password.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withBasicAuth(basicAuth) {
        return this.withHeaders({
            'Authorization': `Basic ${Buffer.from(basicAuth).toString('base64')}`
        });
    }

    /**
     * Specifies whether or not the process will upload the files concurrently. If false, the
     * process will upload one file at a time. If true, the process will upload all files in
     * a concurrent "thread"-like manner. Default value is true.
     *
     * This is a convenience function that is wrapped around setting withMaxConcurrent() to
     * either 1 (if isConcurrent is false) or its default value (if isConcurrent is true).
     *
     * @param {boolean} isConcurrent True if the process should upload files concurrently, false if
     *  they should be uploaded serially.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withConcurrent(isConcurrent) {
        if (isConcurrent) {
            return this.withMaxConcurrent(5);
        } else {
            return this.withMaxConcurrent(1);
        }
    }

    /**
     * Specifies the maximum number of HTTP requests to invoke at one time. Once this number of pending
     * requests is reached, no more requests will be submitted until at least one of the pending
     * requests finishes. A value less than 2 indicates that only one request at a time is allowed,
     * meaning that files will be uploaded serially instead of concurrently. Default value is 5.
     *
     * @param {number} maxConcurrent Maximum number of pending HTTP requests to allow.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withMaxConcurrent(maxConcurrent) {
        this.options.maxConcurrent = maxConcurrent;
        return this;
    }

    /**
     * If true, the process will manually add a "Content-Length" header to requests that upload a
     * file's chunks. If false, the process will assume the header is not needed. The purpose of
     * this option is primarily to support browser upload cases, which won't require this process
     * to add the header. Default: true.
     *
     * @param {boolean} doAddContentLengthHeader True if the process should add its own "Content-Length"
     *  header value.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withAddContentLengthHeader(doAddContentLengthHeader) {
        this.options.addContentLengthHeader = doAddContentLengthHeader;
        return this;
    }

    /**
     * Retrieves the target URL to which files will be uploaded.
     *
     * @returns {string} Target URL as provided to the options instance.
     */
    getUrl() {
        return this.options.url;
    }

    /**
     * Retrieves the path to the folder where the files will be uploaded. This value
     * is based on the URL that was provided to the options.
     *
     * @returns {string} Full path to a folder on the target.
     */
    getTargetFolderPath() {
        const { pathname } = URL.parse(this.getUrl());
        return pathname;
    }

    /**
     * Retrieves the target URL's prefix, which is everything in the URL up to the target path.
     * Will be empty if there is no prefix.
     *
     * @returns {string} The target URL's prefix.
     */
    getUrlPrefix() {
        const {
            protocol,
            host,
        } = URL.parse(this.getUrl());

        return host ? `${protocol}//${host}` : '';
    }

    /**
     * Retrieves the list of files that will be uploaded.
     *
     * @returns {Array} List of UploadFile instances as provided to the options instance.
     */
    getUploadFiles() {
        return this.options.uploadFiles;
    }

    /**
     * Retrieves the headers that will be added to each request sent to the target.
     *
     * @returns {object} The headers as provided to the options instance.
     */
    getHeaders() {
        return this.options.headers || {};
    }

    /**
     * Retrieves a value indicating whether or not the upload process will transfer files
     * concurrently.
     *
     * @returns {boolean} The value as provided to the options instance.
     */
    isConcurrent() {
        return this.getMaxConcurrent() > 1;
    }

    /**
     * Retrieves the maximum number of concurrent HTTP requests that should be allowed.
     *
     * @returns {number} Maximum number.
     */
    getMaxConcurrent() {
        return this.options.maxConcurrent;
    }

    /**
     * Retrieves a value indicating whether or not the upload process will add its own
     * Content-Length header to file chunk requests.
     *
     * @returns {boolean} The value as provided to the options instance.
     */
    addContentLengthHeader() {
        return !!this.options.addContentLengthHeader;
    }

    /**
     * Retrieves an object that can be used to control various aspects of the upload process,
     * including cancelling uploads.
     *
     * @returns {DirectBinaryUploadController} Controller for the upload process.
     */
    getController() {
        return this.controller;
    }

    /**
     * Overridden to return an object appropriate for representing this class as a
     * JSON object.
     *
     * @returns {object} The class's JSON representation.
     */
    toJSON() {
        return this.options;
    }
}
