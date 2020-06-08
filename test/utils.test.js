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

const {
    concurrentLoop,
    exponentialRetry,
    trimRight,
    trimLeft,
    joinUrlPath,
    trimContentDam
} = importFile('utils');
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

    it('test exponential retry', async () => {
        const start = new Date().getTime();
        let count = 0;
        let verified = false;

        try {
            await exponentialRetry({
                retryCount: 4,
                retryDelay: 100,
            }, async () => {
                count++;
                const currTime = new Date().getTime();

                if (count === 1) {
                    should(currTime - start).be.lessThan(100);
                } else if (count === 2) {
                    should(currTime - start).be.greaterThanOrEqual(100);
                    should(currTime - start).be.lessThan(200);
                } else if (count === 3) {
                    should(currTime - start).be.greaterThanOrEqual(300);
                    should(currTime - start).be.lessThan(400);
                } else if (count === 4) {
                    should(currTime - start).be.greaterThanOrEqual(600);
                    should(currTime - start).be.lessThan(700);
                } else {
                    // should not happen this many times
                    should(false).be.ok();
                }

                throw `gonna fail ${count}`;
            });
        } catch (e) {
            verified = true;
            const currTime = new Date().getTime();
            should(currTime - start).be.greaterThanOrEqual(600);
            should(currTime - start).be.lessThan(700);
            should(e).be.exactly('gonna fail 4');
            should(count).be.exactly(4);
        }
        should(verified).be.ok();
    });

    it('test trim right', () => {
        should(trimRight('/test/', ['/'])).be.exactly('/test');
        should(trimRight('/test', ['/'])).be.exactly('/test');
        should(trimRight('/', ['/'])).be.exactly('');
        should(trimRight('', ['/'])).be.exactly('');
        should(trimRight(null, ['/'])).be.exactly(null);
        should(trimRight(1, ['/'])).be.exactly(1);
        should(trimRight('/trim\\]', ['\\', ']'])).be.exactly('/trim');
    });

    it('test trim left', () => {
        should(trimLeft('/test/', ['/'])).be.exactly('test/');
        should(trimLeft('/test', ['/'])).be.exactly('test');
        should(trimLeft('/', ['/'])).be.exactly('');
        should(trimLeft('', ['/'])).be.exactly('');
        should(trimLeft(null, ['/'])).be.exactly(null);
        should(trimLeft(1, ['/'])).be.exactly(1);
        should(trimLeft('\\]trim', ['\\', ']'])).be.exactly('trim');
    });

    it('test join url path', () => {
        should(joinUrlPath('1', '2', '3')).be.exactly('/1/2/3');
        should(joinUrlPath('/1', '/2/', '3/')).be.exactly('/1/2/3');
        should(joinUrlPath('/', '1', '')).be.exactly('/1');
    });

    it('test trim content dam', () => {
        should(trimContentDam('/content/dam')).be.exactly('');
        should(trimContentDam('/content/dam/')).be.exactly('');
        should(trimContentDam('/content/dam/test')).be.exactly('/test');
        should(trimContentDam(null)).be.exactly(null);
        should(trimContentDam('/')).be.exactly('');
        should(trimContentDam('/content/dame')).be.exactly('/content/dame');
        should(trimContentDam('/content/dame/test')).be.exactly('/content/dame/test');
        should(trimContentDam('/test')).be.exactly('/test');
        should(trimContentDam('/test/')).be.exactly('/test');
    });
});
