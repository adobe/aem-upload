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

const originalFetch = require('node-fetch');
const { fetchClient } = require('@adobe/cloud-service-client');

const UploadFile = require('./upload-file');

const fetch = fetchClient(originalFetch, {
  handleCookies: true,
});

/**
 * Submits an HTTP request using fetch, then provides the response.
 * @param {string} url HTTP URL to which request will be submitted.
 * @param {*} options Raw options that will be passed directly to fetch.
 * @returns {*} A fetch HTTP response.
 */
function submitRequest(url, options = {}) {
  return fetch(url, options);
}

/**
 * Converts options provided in a DirectBinaryUploadOptions instance to a format
 * suitable to pass to the httptransfer module.
 * @param {object} options General upload object options.
 * @param {import('./direct-binary-upload-options')} directBinaryUploadOptions Options
 *  to convert.
 */
function getHttpTransferOptions(options, directBinaryUploadOptions) {
  // the httptransfer module accepts a full fileUrl instead of a single
  // url with individual file names. if needed, convert the format with a
  // single url and individual file names to the fileUrl format.
  const convertedFiles = directBinaryUploadOptions.getUploadFiles().map((uploadFile) => {
    const uploadFileInstance = new UploadFile(options, directBinaryUploadOptions, uploadFile);
    const transferOptions = uploadFileInstance.toJSON();
    if (uploadFile.blob) {
      // ensure blob is passed through to transfer options
      transferOptions.blob = uploadFile.blob;
    }
    return transferOptions;
  });

  let headers = {};
  const requestOptions = { ...directBinaryUploadOptions.getHttpOptions() };
  if (requestOptions.headers) {
    // passing raw request options to node-httptransfer is somewhat limited because the
    // options will be used by init/complete requests to AEM, and inidividual part
    // transfers to blob storage. some options interfere with blob storage when included,
    // so removing headers here so that they won't be sent to blob storage.
    headers = { ...requestOptions.headers };
    delete requestOptions.headers;
  }

  const retryOptions = {
    retryInitialDelay: directBinaryUploadOptions.getHttpRetryDelay(),
    retryMaxCount: directBinaryUploadOptions.getHttpRetryCount(),
    retryAllErrors: false,
  };
  if (requestOptions.cloudClient) {
    retryOptions.retryAllErrors = requestOptions.cloudClient.eventuallyConsistentCreate || false;
    delete requestOptions.cloudClient;
  }

  const transferOptions = {
    uploadFiles: convertedFiles,
    concurrent: directBinaryUploadOptions.isConcurrent(),
    maxConcurrent: directBinaryUploadOptions.getMaxConcurrent(),
    timeout: directBinaryUploadOptions.getHttpRequestTimeout(),
    headers,
    requestOptions: {
      retryOptions,
      ...requestOptions,
    },
  };

  return transferOptions;
}

module.exports = {
  submitRequest,
  getHttpTransferOptions,
};
