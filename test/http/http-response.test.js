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

/* eslint-env mocha */

const should = require('should');

const { importFile } = require('../testutils');

const HttpResponse = importFile('http/http-response');

describe('HTTP Response Tests', () => {
  it('test accessors', () => {
    const response = new HttpResponse({}, {
      status: 200,
      statusText: 'OK',
      headers: {
        header1: 'test1',
      },
      data: 'hello',
      elapsedTime: 100,
    });

    should(response.getStatusCode()).be.exactly(200);
    should(response.getStatusText()).be.exactly('OK');
    should(response.getHeaders().header1).be.exactly('test1');
    should(response.getData()).be.exactly('hello');
    should(response.getElapsedTime()).be.exactly(100);
  });
});
