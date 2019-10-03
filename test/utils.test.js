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

const { importFile } = require('./testutils');

const { concurrentLoop } = importFile('utils');
const { DefaultValues } = importFile('constants');

describe('UtilsTest', () => {
    describe('concurrentLoop tests', () => {
        async function runMaxConcurrentTest(maxValue) {
            let currCount = 0;
            const testArray = [];
            for (let i = 0; i < 10; i += 1) {
                testArray[i] = i;
            }

            const params = [];
            params.push(testArray);

            if (maxValue) {
                params.push(maxValue);
            }

            params.push(() => {
                return new Promise(res => {
                    should(currCount).be.lessThan(maxValue || DefaultValues.MAX_CONCURRENT);
                    currCount += 1;
                    setTimeout(() => {
                        currCount -= 1;
                        res();
                    }, 100);
                });
            });

            await concurrentLoop.apply(null, params);
        }

        it('test max concurrent', async () => {
            await runMaxConcurrentTest();
        });

        it('test max concurrent value', async () => {
            await runMaxConcurrentTest(7);
        });
    });
});
