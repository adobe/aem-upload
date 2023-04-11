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
    getHttpClient,
    getPathTitle,
    createAemFolder,
    getAemEndpoint,
} = require('./e2eutils');

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const FileSystemUploadOptions = importFile('filesystem-upload-options');
const FileSystemUpload = importFile('filesystem-upload');

const ENCODED_ASSET1 = `${decodeURI('%ec%9d%b4%eb%91%90%e5%90%8f%e8%ae%80')}.jpg`;
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
        upload.on('foldercreated', data => events.push({ event: 'foldercreated', data }));
    }

    function hasEventCheck(eventName, targetFolder, path, pathFunc) {
        const checkPath = decodeURI(new URL(`${targetFolder}${path}`).pathname);
        for (let i = 0; i < events.length; i++) {
            const { event, data } = events[i];

            if (event === eventName && pathFunc(data) === checkPath) {
                return true;
            }
        }
        return false;
    }

    function hasEvent(eventName, targetFolder, filePath) {
        return hasEventCheck(eventName, targetFolder, filePath, (data) => {
            return data.targetFile;
        });
    }

    function hasStartAndStopEvents(targetFolder, filePath) {
        const hasStart = hasEvent('filestart', targetFolder, filePath);
        const hasEnd = hasEvent('fileend', targetFolder, filePath);
        return hasStart && hasEnd;
    }

    async function verifyExistsInAemAndHasEvents(httpClient, uploadOptions, filePath) {
        const exists = await doesAemPathExist(httpClient, uploadOptions, filePath);
        const hasEvents = hasStartAndStopEvents(uploadOptions.getUrl(), filePath);
        should(exists).be.ok();
        should(hasEvents).be.ok();
    }

    async function verifyExistsInAemAndHasTitle(httpClient, uploadOptions, filePath, title) {
        should(await doesAemPathExist(httpClient, uploadOptions, filePath)).be.ok();
        should(await getPathTitle(httpClient, uploadOptions, filePath)).be.exactly(title);
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
        should(uploadResult.getCreateDirectoryResults().length).be.exactly(2);
        should(uploadResult.getCreateDirectoryResults()[1].getFolderPath()).be.exactly(new URL(targetFolder).pathname);

        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/skiing_1.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/freeride.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/freeride-steep.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/ice-climbing.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, `/${ENCODED_ASSET1}`);
        should(await doesAemPathExist(httpClient, uploadOptions, '/dir-1')).not.be.ok();

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
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/skiing_1.jpg');

        // images
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/climber-ferrata-la-torre-di-toblin.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/Freeride-extreme.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/freeride-siberia.jpg');

        // images/dir1
        await verifyExistsInAemAndHasTitle(httpClient, uploadOptions, '/images/dir-1', 'Dir 1');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/freeride.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/freeride-steep.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/ice-climbing.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, `/images/dir-1/${ENCODED_ASSET1}`);

        // images/dir1/subdir1
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/ski touring.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/skiing_1.jpg');
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/images/dir-1/subdir1/skiing_2.jpg');

        // images/dir1/folder_♂♀°′″℃＄￡‰§№￠℡㈱
        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, `/images/dir-1/${ENCODED_FOLDER}/${ENCODED_ASSET2}`);

        should(hasEventCheck('foldercreated', targetFolder, '/images/dir-1/subdir2', (data) => {
            return data.targetFolder;
        })).be.ok();
        should(await doesAemPathExist(httpClient, uploadOptions, '/images/dir-1/subdir2')).be.ok();

        return deleteAemPath(httpClient, uploadOptions);
    });

    it('zero byte file test', async function() {
        const targetFolder = getTargetFolder();
        const uploadOptions = new FileSystemUploadOptions()
            .withUrl(targetFolder);

        setCredentials(uploadOptions);

        const fileSystemUpload = new FileSystemUpload(getTestOptions());

        monitorEvents(fileSystemUpload);

        await fileSystemUpload.upload(uploadOptions, [
            Path.join(__dirname, 'edge-case-images/zero-byte.jpg'),
        ]);
        should(events.length).be.exactly(2);
        should(events[0].event).be.exactly('foldercreated');
        should(events[1].event).be.exactly('fileerror');
    });

    it('GB18030 folder upload test', async function() {
        const folderName = `aem-upload-e2e_中文_${new Date().getTime()}`;
        const targetFolder = `${getAemEndpoint()}/content/dam`;
        const uploadOptions = new DirectBinaryUploadOptions()
            .withUrl(targetFolder);

        setCredentials(uploadOptions);

        const httpClient = getHttpClient(uploadOptions);

        await createAemFolder(httpClient, uploadOptions, folderName);

        const fileSystemUpload = new FileSystemUpload(getTestOptions());

        monitorEvents(fileSystemUpload);

        const uploadUrl = `${targetFolder}/${encodeURI(folderName)}`;
        uploadOptions.withUrl(uploadUrl);

        const uploadResult = await fileSystemUpload.upload(uploadOptions, [
            Path.join(__dirname, 'images/climber-ferrata-la-torre-di-toblin.jpg'),
        ]);

        should(uploadResult).be.ok();

        await verifyExistsInAemAndHasEvents(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');

        const doubleEncodedUrl = `${targetFolder}/${encodeURI(encodeURI(folderName))}`;
        uploadOptions.withUrl(doubleEncodedUrl);

        const doubleEncodedExists = await doesAemPathExist(httpClient, uploadOptions, '/climber-ferrata-la-torre-di-toblin.jpg');
        should(doubleEncodedExists).not.be.ok();

        uploadOptions.withUrl(uploadUrl);
        return deleteAemPath(httpClient, uploadOptions);
    })

});
