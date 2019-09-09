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

import URL from 'url';
import UploadFile from './upload-file';

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
        this.options = {};
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
     * An array of UploadFile instances representing the files that will be uploaded
     * to the target URL.
     *
     * @param {UploadFile} uploadFiles Files to upload to the target.
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
     * @param {object} headers Keys should be header names, values should be the header's value.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withHeaders(headers) {
        this.options.headers = headers;
        return this;
    }

    /**
     * Specifies whether or not the process will upload the files concurrently. If false, the
     * process will upload one file at a time. If true, the process will upload all files in
     * a concurrent "thread"-like manner. Default value is true.
     *
     * @param {boolean} isConcurrent True if the process should upload files concurrently, false if
     *  they should be uploaded serially.
     * @returns {DirectBinaryUploadOptions} The current options instance. Allows for chaining.
     */
    withConcurrent(isConcurrent) {
        this.options.concurrent = isConcurrent;
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
        return !!this.options.concurrent;
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
     * Overridden to return an object appropriate for representing this class as a
     * JSON object.
     *
     * @returns {object} The class's JSON representation.
     */
    toJSON() {
        return this.options;
    }
}
