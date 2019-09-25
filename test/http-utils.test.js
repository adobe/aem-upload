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

const should = require('should');

const { importFile } = require('./testutils');
const MockRequest = require('./mock-request');

const { timedRequest } = importFile('http-utils');

describe('HttpUtilsTest', () => {
    beforeEach(() => {
        MockRequest.reset();
    });

    describe('timedRequest', () => {
        it('smoke test', async () => {
            MockRequest.onGet('http://timedrequestunittest').reply(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve([200, { success: true }]);
                    }, 100);
                });
            });

            const {
                status,
                elapsedTime,
            } = await timedRequest({
                url: 'http://timedrequestunittest',
            });

            should(status).be.exactly(200);
            should(elapsedTime >= 100).be.ok();
        });
    });
});