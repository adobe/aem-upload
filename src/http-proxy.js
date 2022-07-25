/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import URL from 'url';

import UploadError from './upload-error';
import ErrorCodes from './error-codes';
import { getBasicAuth } from './http-utils';

const PRIVATE = Symbol('PRIVATE');

/**
 * Represents information about the proxy to use when sending HTTP requests.
 */
export default class HttpProxy {
    /**
     * Constructs new proxy information using the given proxy URL. By default, authentication will not be used with the proxy.
     * @param {string} proxyUrl Full URL of the HTTP proxy to be used. Example: http://localhost:5000.
     */
    constructor(proxyUrl) {
        this[PRIVATE] = {
            proxyUrl
        };
    }

    /**
     * Retrieves the URL of the proxy as it was provided on construction.
     * @returns {URL} Full URL of an HTTP proxy.
     */
    getUrl() {
        const { proxyUrl } = this[PRIVATE];
        if (!proxyUrl) {
            throw new UploadError('URL of proxy is required', ErrorCodes.INVALID_OPTIONS);
        }
        return URL.parse(proxyUrl);
    }

    /**
     * Retrieves the name of the user being used for authentication. Will return falsy if basic
     * authentication has not been set.
     * @returns {string} Username for basic authentication.
     */
    getBasicAuthUser() {
        return getBasicAuth(this[PRIVATE]).username;
    }

    /**
     * Retrieves the password of the user being used for authentication. Will return falsy if basic
     * authentication has not been set.
     * @returns {string} Password for basic authentication.
     */
    getBasicAuthPassword() {
        return getBasicAuth(this[PRIVATE]).password;
    }

    /**
     * Sets the basic authentication to be used with the proxy.
     * @param {string} user Name of the user to use for authentication.
     * @param {string} password Password for the user to use for authentication.
     * @returns {HttpProxy} Current instance, for chaining.
     */
    withBasicAuth(user, password) {
        this[PRIVATE].username = user;
        this[PRIVATE].password = password;
        return this;
    }

    /**
     * Retrieves a simple JSON representation of the proxy info. This will be in the format expected by the
     * "proxy" option of an axios request.
     * @returns {object} All information about the proxy.
     */
    toJSON() {
        const {
            protocol,
            hostname,
            port
        } = this.getUrl();
        const json = {
            protocol: protocol === 'https:' ? 'https' : 'http',
            host: hostname,
            port: parseInt(port, 10)
        };
        const username = this.getBasicAuthUser();
        const password = this.getBasicAuthPassword();
        if (username) {
            json.auth = {
                username,
                password
            };
        }
        return json;
    }
}
