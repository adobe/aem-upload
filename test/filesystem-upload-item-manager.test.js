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

const should = require('should');

const { importFile } = require('./testutils');

const FileSystemUploadOptions = importFile('filesystem-upload-options');
const FileSystemUploadItemManager = importFile('filesystem-upload-item-manager');

describe('FileSystemUploadItemManager Tests', function() {
    let options;

    beforeEach(function() {
        options = new FileSystemUploadOptions()
            .withUrl('http://someunittestfakeurl/content/dam/target');
    });

    it('test get directory', async function () {
        const manager = new FileSystemUploadItemManager(options, '\\fake\\test\\directory\\');
        should(manager.hasDirectory('/fake/test/directory/')).not.be.ok();
        should(manager.hasDirectory('/fake/test/directory/child')).not.be.ok();
        should(manager.hasDirectory('/fake/test')).not.be.ok();

        const subChild = await manager.getDirectory('/fake/test/directory/Child Dir/Sub Child/');
        should(subChild).be.ok();
        should(subChild.getLocalPath()).be.exactly('/fake/test/directory/Child Dir/Sub Child');
        should(subChild.getRemotePath()).be.exactly('/content/dam/target/directory/child-dir/sub-child');
        should(subChild.getName()).be.exactly('Sub Child');
        should(manager.hasDirectory('/fake/test/directory/')).be.ok();
        should(manager.hasDirectory('/fake/test/directory/Child Dir')).be.ok();
        should(manager.hasDirectory('/fake/test/directory/Child Dir/Sub Child')).be.ok();
        should(manager.hasDirectory('/fake/test')).not.be.ok();

        const child = await manager.getDirectory('/fake/test/directory/Child Dir');
        should(child).be.ok();
        should(child.getLocalPath()).be.exactly('/fake/test/directory/Child Dir');
        should(child.getRemotePath()).be.exactly('/content/dam/target/directory/child-dir');
        should(child.getName()).be.exactly('Child Dir');

        should(manager.getDirectory('/fake/test')).be.rejected();
    });

    it('test get asset', async function() {
        const folderPath = '/fake/asset/directory';
        const assetPath = `${folderPath}/Asset #1.jpg`;
        const manager = new FileSystemUploadItemManager(options, '/fake/asset/directory');
        should(manager.hasAsset(assetPath)).not.be.ok();

        const asset = await manager.getAsset(assetPath, 1024);
        should(asset).be.ok();
        should(asset.getLocalPath()).be.exactly(assetPath);
        should(asset.getRemotePath()).be.exactly('/content/dam/target/directory/Asset -1.jpg');
        should(asset.getSize()).be.exactly(1024);
        should(asset.getParentRemoteUrl()).be.exactly('http://someunittestfakeurl/content/dam/target/directory');
        should(manager.hasAsset(assetPath)).be.ok();
        should(manager.hasDirectory(folderPath)).be.ok();
    });

    it('test get root asset', async function() {
        const assetPath = '/fake/asset/directory/Asset #1.jpg';
        const manager = new FileSystemUploadItemManager(options, assetPath);
        should(manager.hasAsset(assetPath)).not.be.ok();

        const asset = await manager.getAsset(assetPath, 1024);
        should(asset).be.ok();
        should(asset.getLocalPath()).be.exactly(assetPath);
        should(asset.getRemotePath()).be.exactly('/content/dam/target/Asset -1.jpg');
        should(asset.getSize()).be.exactly(1024);
        should(asset.getParentRemoteUrl()).be.exactly('http://someunittestfakeurl/content/dam/target');
        should(manager.hasAsset(assetPath)).be.ok();
    });
});
