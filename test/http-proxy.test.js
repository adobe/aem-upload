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

const should = require('should');

const {
    importFile,
} = require('./testutils');
const HttpProxy = importFile('http-proxy');

describe('HTTP proxy tests', () => {
    it('test accessors', () => {
        let proxy = new HttpProxy('http://localhost:1234');
        should(proxy.getUrl().href).be.exactly('http://localhost:1234/');
        should(proxy.getBasicAuthUser()).not.be.ok();
        should(proxy.getBasicAuthPassword()).not.be.ok();
        should(proxy.toHttpOptions()).deepEqual({
            protocol: 'http',
            host: 'localhost',
            port: 1234
        });
        should(proxy.toJSON()).deepEqual({
            protocol: 'http',
            host: 'localhost',
            port: 1234
        });

        proxy = new HttpProxy('https://127.0.0.1:4321')
            .withBasicAuth('user', 'pass');
        should(proxy.getUrl().href).be.exactly('https://127.0.0.1:4321/');
        should(proxy.getBasicAuthUser()).be.exactly('user');
        should(proxy.getBasicAuthPassword()).be.exactly('pass');
        should(proxy.toHttpOptions()).deepEqual({
            protocol: 'https',
            host: '127.0.0.1',
            port: 4321,
            auth: {
                username: 'user',
                password: 'pass'
            }
        });
        should(proxy.toJSON()).deepEqual({
            protocol: 'https',
            host: '127.0.0.1',
            port: 4321,
            auth: {
                username: '<redacted>',
                password: '<redacted>'
            }
        });
    });

    it('test with missing url', () => {
        const proxy = new HttpProxy();
        should.throws(() => {
            proxy.getUrl();
        });
    });

    it('test with invalid url', () => {
        const proxy = new HttpProxy(HttpProxy);
        should.throws(() => {
            proxy.getUrl();
        });
    });

    it('test with missing user', () => {
        const proxy = new HttpProxy('http://localhost:1234')
        should.throws(() => {
            proxy.withBasicAuth('', 'pass');
        })
    });

    it('test with missing password', () => {
        const proxy = new HttpProxy('http://localhost:1234')
        should.throws(() => {
            proxy.withBasicAuth('user');

        });
    });
});
