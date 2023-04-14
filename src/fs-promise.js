/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fs = require('fs');
const UploadError = require('./upload-error');
const ErrorCodes = require('./error-codes');

const unsupportedError = () => {
  throw new UploadError('filesystem operations are not permitted in a browser', ErrorCodes.INVALID_OPTIONS);
};

let stat = unsupportedError;
let readdir = unsupportedError;
let createReadStream = unsupportedError;

// fs module is not supported in browsers
if (fs) {
  // doing this manually and not using promisify to support older
  // versions of node
  stat = (path) => new Promise((res, rej) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        rej(err);
        return;
      }
      res(stats);
    });
  });
  readdir = (path) => new Promise((res, rej) => {
    fs.readdir(path, (err, result) => {
      if (err) {
        rej(err);
        return;
      }
      res(result);
    });
  });
  createReadStream = fs.createReadStream;
}

module.exports = {
  stat,
  readdir,
  createReadStream,
};
