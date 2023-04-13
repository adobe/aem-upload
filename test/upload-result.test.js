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
const Sinon = require('sinon');

const { importFile } = require('./testutils');

const UploadResult = importFile('upload-result');

describe('UploadResult Tests', () => {
  // eslint-disable-next-line func-names
  before(function () {
    this.clock = Sinon.useFakeTimers(10);
  });

  // eslint-disable-next-line func-names
  after(function () {
    this.clock.restore();
  });

  // eslint-disable-next-line func-names
  it('test timer', async function () {
    const uploadResult = new UploadResult();
    uploadResult.startTimer();
    this.clock.tick(20);
    uploadResult.stopTimer();
    should(uploadResult.getElapsedTime() >= 20).be.ok();
    uploadResult.startTimer();
    this.clock.tick(20);
    uploadResult.stopTimer();
    should(uploadResult.getElapsedTime() >= 40).be.ok();
  });
});
