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

const { EventEmitter } = require('events');
const util = require('util');
const { Readable } = require('stream');

function MockBlob() {
  EventEmitter.call(this);
  this.slices = [];
}

util.inherits(MockBlob, EventEmitter);

MockBlob.prototype.getSlices = () => this.slices;

MockBlob.prototype.slice = (start, end) => {
  const data = `${start},${end},`;
  let called = false;

  this.slices.push({ start, end });

  const slice = new Readable({
    read() {
      if (!called) {
        this.push(data);
        called = true;
      } else {
        this.push(null);
      }
    },
  });

  slice.mockData = data;

  return slice;
};

module.exports = MockBlob;
