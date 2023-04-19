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

/* eslint-env mocha */

const should = require('should');
const mock = require('mock-fs');

const {
  concurrentLoop,
  trimRight,
  trimLeft,
  joinUrlPath,
  trimContentDam,
  walkDirectory,
} = require('../src/utils');
const { DefaultValues } = require('../src/constants');

describe('UtilsTest', () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
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

      params.push(() => new Promise((res) => {
        should(currCount).be.lessThan(maxValue || DefaultValues.MAX_CONCURRENT);
        currCount += 1;
        setTimeout(() => {
          currCount -= 1;
          res();
        }, 100);
      }));

      await concurrentLoop(...params);
    }

    it('test max concurrent', async () => {
      await runMaxConcurrentTest();
    });

    it('test max concurrent value', async () => {
      await runMaxConcurrentTest(7);
    });
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
    for (let i = 0; i < itemList.length; i += 1) {
      const { path: comparePath } = itemList[i];
      if (path === comparePath) {
        return i;
      }
    }
    return -1;
  }

  function createDirectoryStructure() {
    mock({
      '/root': {
        'file1.jpg': '1234',
        'file2.jpg': '1234',
        dir1: {
          'file3.jpg': '1234',
          'file4.jpg': '1234',
          dir2: {
            dir3: {
              'file5.jpg': '1234',
              'file6.jpg': '1234',
            },
          },
        },
        '.tempdir': {},
        '.tempfile.jpg': '1234',
        error: mock.directory({
          uid: 'invalid',
          gid: 'invalid',
          mode: 0,
        }),
        'error.jpg': mock.symlink({
          path: '/invalid-path',
        }),
        emptydir: {
          emptysubdir: {},
        },
      },
    });
  }

  it('test walk directory with descendents', async () => {
    createDirectoryStructure();

    const {
      directories, files, totalSize, errors,
    } = await walkDirectory('/root');
    should(directories.length).be.exactly(6);
    should(files.length).be.exactly(6);
    should(totalSize).be.exactly(files.length * 4);
    should(errors.length).be.exactly(2);

    const dir1 = getPathIndex(directories, '/root/dir1');
    const dir2 = getPathIndex(directories, '/root/dir1/dir2');
    const dir3 = getPathIndex(directories, '/root/dir1/dir2/dir3');
    const dir4 = getPathIndex(directories, '/root/emptydir');
    const dir5 = getPathIndex(directories, '/root/emptydir/emptysubdir');
    const dir6 = getPathIndex(directories, '/root/error');

    should(dir1 >= 0 && dir1 > dir2 && dir1 > dir3);
    should(dir2 >= 0 && dir2 > dir3);
    should(dir3 >= 0);
    should(dir6 >= 0);
    should(dir4 >= 0);
    should(dir5 > dir4);

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

  it('test walk directory no descendents', async () => {
    createDirectoryStructure();

    const {
      directories, files, totalSize, errors,
    } = await walkDirectory('/root', 1000, false);
    should(directories.length).be.exactly(3);

    const dir1 = getPathIndex(directories, '/root/dir1');
    const dir2 = getPathIndex(directories, '/root/error');
    const dir3 = getPathIndex(directories, '/root/emptydir');
    should(dir1 >= 0);
    should(dir2 >= 0);
    should(dir3 >= 0);

    should(files.length).be.exactly(2);
    should(totalSize).be.exactly(files.length * 4);
    should(errors.length).be.exactly(1);

    const file1 = getPathIndex(files, '/root/file1.jpg');
    const file2 = getPathIndex(files, '/root/file2.jpg');

    should(file1 >= 0 && file1 < file2).be.ok();
    should(file2 >= 0).be.ok();
  });
});
