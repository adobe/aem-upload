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

import HttpRequest from './http/http-request';

export const getCSRFToken = async (httpClient, options, uploadOptions) => {
    try {
        let tokenResult;
        const origin = new URL(uploadOptions.getUrl()).origin;
        const tokenRequestUrl = `${origin}/libs/granite/csrf/token.json`;
        const tokenRequest = new HttpRequest(options, tokenRequestUrl)
            .withMethod(HttpRequest.Method.GET)
            .withResponseType(HttpRequest.ResponseType.JSON)
            .withUploadOptions(uploadOptions);
        const response = await httpClient.submit(tokenRequest, tokenResult);

        return response.getData().token;
    } catch (e) {
        throw new Error(`Fail to retrieve CSRF token before uploading with err ${e}`);
    }
}