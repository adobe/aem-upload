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

const should = require('should');
const cookie = require('cookie');

const { importFile } = require('./testutils');

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');

describe('DirectBinaryUploadOptionsTest', () => {
    it('test url slashes', () => {
        const options = new DirectBinaryUploadOptions()
            .withUrl('/');

        should(options.getUrl()).be.exactly('/');
        options.withUrl('/trailing/');
        should(options.getUrl()).be.exactly('/trailing');
    });

    it('test cookies', () => {
        let options = new DirectBinaryUploadOptions()
            .withCookies({ cookie: 'value' });

        let cookies = cookie.parse(options.getHeaders()['Cookie']);
        should(cookies).be.ok();
        should(cookies.cookie).be.exactly('value');

        options = options.withCookies({ cookie: 'value2', anotherCookie: 'another' });
        cookies = cookie.parse(options.getHeaders()['Cookie']);
        should(cookies).be.ok();
        should(cookies.cookie).be.exactly('value2');
        should(cookies.anotherCookie).be.exactly('another');
    });
});
