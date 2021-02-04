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
const Path = require('path');

const { importFile } = require('./testutils');

let dirs = {};
let stats = {};

const {
    concurrentLoop,
    exponentialRetry,
    trimRight,
    trimLeft,
    joinUrlPath,
    trimContentDam,
    walkDirectory
} = importFile('utils', {
    './fs-promise': {
        stat: async function(path) {
            if (Path.basename(path) === 'error.jpg') {
                throw new Error('unit test stat error');
            }
            return stats[path];
        },
        readdir: async function(path) {
            if (Path.basename(path) === 'error') {
                throw new Error('unit test readdir error');
            }
            return dirs[path];
        }
    }
});
const { DefaultValues } = importFile('constants');

describe('UtilsTest', function () {
    function addFileSystem(fullPath, isDir, size = 0) {
        stats[fullPath] = {
            isDirectory: () => isDir,
            isFile: () => !isDir,
            size
        };

        const parent = Path.dirname(fullPath);
        if (!dirs[parent]) {
            dirs[parent] = [];
        }
        dirs[parent].push(Path.basename(fullPath));
    }

    beforeEach(() => {
        dirs = {};
        stats = {};
    });

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

    function getPathIndex(itemList, path) {
        for (let i = 0; i < itemList.length; i++) {
            const { path: comparePath } = itemList[i];
            if (path === comparePath) {
                return i;
            }
        }
        return -1;
    }

    function createDirectoryStructure() {
        addFileSystem('/root', true);
        addFileSystem('/root/file1.jpg', false, 1024);
        addFileSystem('/root/file2.jpg', false, 1024);
        addFileSystem('/root/dir1', true);
        addFileSystem('/root/dir1/file3.jpg', false, 1024);
        addFileSystem('/root/dir1/file4.jpg', false, 1024);
        addFileSystem('/root/dir1/dir2', true);
        addFileSystem('/root/dir1/dir2/dir3', true);
        addFileSystem('/root/dir1/dir2/dir3/file5.jpg', false, 1024);
        addFileSystem('/root/dir1/dir2/dir3/file6.jpg', false, 1024);
        addFileSystem('/root/.tempdir', true);
        addFileSystem('/root/.tempfile.jpg', false, 1024);
        addFileSystem('/root/error', true);
        addFileSystem('/root/error.jpg', false, 1024);
        addFileSystem('/root/emptydir', true);
        addFileSystem('/root/emptydir/emptysubdir', true);
    }

    it('test walk directory', async function () {
        createDirectoryStructure();

        const { directories, files, totalSize, errors } = await walkDirectory('/root');
        should(directories.length).be.exactly(3);
        should(files.length).be.exactly(6);
        should(totalSize).be.exactly(files.length * 1024);
        should(errors.length).be.exactly(2);

        const dir1 = getPathIndex(directories, '/root/dir1');
        const dir2 = getPathIndex(directories, '/root/dir1/dir2');
        const dir3 = getPathIndex(directories, '/root/dir1/dir2/dir3');

        should(dir1 >= 0 && dir1 > dir2 && dir1 > dir3);
        should(dir2 >= 0 && dir2 > dir3);
        should(dir3 >= 0);

        const file1 = getPathIndex(files, '/root/file1.jpg');
        const file2 = getPathIndex(files, '/root/file2.jpg');
        const file3 = getPathIndex(files, '/root/dir1/file3.jpg');
        const file4 = getPathIndex(files, '/root/dir1/file4.jpg');
        const file5 = getPathIndex(files, '/root/dir1/dir2/dir3/file5.jpg');
        const file6 = getPathIndex(files, '/root/dir1/dir2/dir3/file6.jpg');

        should(file1 >= 0 && file1 < file3 && file1 < file4 && file1 < file5 && file1 < file6).be.ok();
        should(file2 >= 0 && file2 < file3 && file2 < file4 && file2 < file5 && file2 < file6).be.ok();
        should(file3 >= 0 && file3 < file5 && file3 < file6).be.ok();
        should(file4 >= 0 && file4 < file5 && file4 < file6).be.ok();
        should(file5 >= 0).be.ok();
        should(file6 >= 0).be.ok();
    });

    it('test walk directory no descendents', async function () {
        createDirectoryStructure();

        const { directories, files, totalSize, errors } = await walkDirectory('/root', 1000, false);
        should(directories.length).be.exactly(0);
        should(files.length).be.exactly(2);
        should(totalSize).be.exactly(files.length * 1024);
        should(errors.length).be.exactly(1);

        const file1 = getPathIndex(files, '/root/file1.jpg');
        const file2 = getPathIndex(files, '/root/file2.jpg');

        should(file1 >= 0 && file1 < file2).be.ok();
        should(file2 >= 0).be.ok();
    });
});
