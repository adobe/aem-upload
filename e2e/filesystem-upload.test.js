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

const Path = require('path');
const should = require('should');

const {
    importFile,
    getTargetFolder,
    getTestOptions,
    setCredentials,
    doesAemPathExist,
    deleteAemPath,
    getHttpClient
} = require('./e2eutils');

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const FileSystemUploadOptions = importFile('filesystem-upload-options');
const FileSystemUpload = importFile('filesystem-upload');

const ENCODED_ASSET1 = `${decodeURI('%E1%84%8B%E1%85%B5%E1%84%83%E1%85%AE%E5%90%8F%E8%AE%80')}.jpg`;
const ENCODED_FOLDER = `folder_${decodeURI('%e2%99%82%e2%99%80%c2%b0%e2%80%b2%e2%80%b3%e2%84%83%ef%bc%84%ef%bf%a1%e2%80%b0%c2%a7%e2%84%96%ef%bf%a0%e2%84%a1%e3%88%b1')}`;
const ENCODED_ASSET2 = `${decodeURI('%e9%83%8e%e7%a4%bc')}.jpg`;

describe('FileSystemUpload end-to-end tests', function() {
    this.timeout(1000 * 60);

    let events = [];

    function monitorEvents(upload) {
        upload.on('filestart', data => events.push({ event: 'filestart', data }));
        upload.on('fileprogress', data => events.push({ event: 'fileprogress', data }));
        upload.on('fileend', data => events.push({ event: 'fileend', data }));
        upload.on('fileerror', data => events.push({ event: 'fileerror', data }));
        upload.on('filecancelled', data => events.push({ event: 'filecancelled', data }));
    }

    function hasEvent(eventName, targetFolder, filePath) {
        const checkPath = decodeURI(new URL(`${targetFolder}${filePath}`).pathname);
        for (let i = 0; i < events.length; i++) {
            const { event, data } = events[i];

            if (event === eventName && data.targetFile === checkPath) {
                return true;
            }
        }
        return false;
    }

    function hasStartAndStopEvents(targetFolder, filePath) {
        const hasStart = hasEvent('filestart', targetFolder, filePath);
        const hasEnd = hasEvent('fileend', targetFolder, filePath);
        return hasStart && hasEnd;
    }

    async function existsInAemAndHasEvents(httpClient, uploadOptions, filePath) {
        return await doesAemPathExist(httpClient, uploadOptions, filePath) &&
            hasStartAndStopEvents(uploadOptions.getUrl(), filePath);
    }

    beforeEach(function() {
        events = [];
    });

    it('shallow upload test', async function() {
        const targetFolder = getTargetFolder();
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl(targetFolder);

        setCredentials(uploadOptions);

        const httpClient = getHttpClient(uploadOptions);
        const fileSystemUpload = new FileSystemUpload(getTestOptions());

        monitorEvents(fileSystemUpload);

        const uploadResult = await fileSystemUpload.upload(uploadOptions, [
            Path.join(__dirname, 'images/Dir 1'),
            Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
            Path.join(__dirname, 'images/Dir 1/subdir1/skiing_1.jpg'),
        ]);

        should(uploadResult).be.ok();
        should(uploadResult.getErrors().length).be.exactly(0);
        should(uploadResult.getUploadErrors().length).be.exactly(0);
        should(uploadResult.getInitTime()).be.ok();
        should(uploadResult.getTotalFiles()).be.exactly(6);
        should(uploadResult.getTotalCompletedFiles()).be.exactly(uploadResult.getTotalFiles());
        should(uploadResult.getElapsedTime()).be.ok();
        should(uploadResult.getTotalSize()).be.exactly(1860489);
        should(uploadResult.getAverageFileSize()).be.exactly(310082);
        should(uploadResult.getAverageFileUploadTime()).be.ok();
        should(uploadResult.getAveragePartUploadTime()).be.ok();
        should(uploadResult.getAverageCompleteTime()).be.ok();
        should(uploadResult.getNinetyPercentileTotal()).be.ok();
        should(uploadResult.getFileUploadResults().length).be.exactly(uploadResult.getTotalFiles());

        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/skiing_1.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/freeride.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/freeride-steep.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/ice-climbing.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, `/${ENCODED_ASSET1}`)).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/dir-1')).not.be.ok();

        return deleteAemPath(httpClient, uploadOptions);
    });

    it('deep upload test', async function() {
        const targetFolder = getTargetFolder();
        const uploadOptions = new FileSystemUploadOptions()
            .withUrl(targetFolder)
            .withDeepUpload(true);

        setCredentials(uploadOptions);

        const httpClient = getHttpClient(uploadOptions);
        const fileSystemUpload = new FileSystemUpload(getTestOptions());

        monitorEvents(fileSystemUpload);

        const uploadResult = await fileSystemUpload.upload(uploadOptions, [
            Path.join(__dirname, 'images'),
            Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
            Path.join(__dirname, 'images/Dir 1/subdir1/skiing_1.jpg'),
        ]);

        should(uploadResult).be.ok();
        should(uploadResult.getErrors().length).be.exactly(0);
        should(uploadResult.getUploadErrors().length).be.exactly(0);
        should(uploadResult.getInitTime()).be.ok();
        should(uploadResult.getTotalFiles()).be.exactly(13);
        should(uploadResult.getTotalCompletedFiles()).be.exactly(uploadResult.getTotalFiles());
        should(uploadResult.getElapsedTime()).be.ok();
        should(uploadResult.getTotalSize()).be.exactly(3968893);
        should(uploadResult.getAverageFileSize()).be.exactly(305299);
        should(uploadResult.getAverageFileUploadTime()).be.ok();
        should(uploadResult.getAveragePartUploadTime()).be.ok();
        should(uploadResult.getAverageCompleteTime()).be.ok();
        should(uploadResult.getNinetyPercentileTotal()).be.ok();
        should(uploadResult.getFileUploadResults().length).be.exactly(uploadResult.getTotalFiles());

        // files supplied directly
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/skiing_1.jpg')).be.ok();

        // images
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/climber-ferrata-la-torre-di-toblin.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/Freeride-extreme.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/freeride-siberia.jpg')).be.ok();

        // images/dir1
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/freeride.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/freeride-steep.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/ice-climbing.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, `/images/dir-1/${ENCODED_ASSET1}`)).be.ok();

        // images/dir1/subdir1
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/ski touring.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/skiing_1.jpg')).be.ok();
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/skiing_2.jpg')).be.ok();

        // images/dir1/folder_♂♀°′″℃＄￡‰§№￠℡㈱
        should(await existsInAemAndHasEvents(httpClient, uploadOptions, `/images/dir-1/${ENCODED_FOLDER}/${ENCODED_ASSET2}`)).be.ok();

        should(await doesAemPathExist(httpClient, uploadOptions, '/images/dir-1/subdir2')).not.be.ok();

        return deleteAemPath(httpClient, uploadOptions);
    });

});
