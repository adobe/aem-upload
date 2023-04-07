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

require('core-js');
require('regenerator-runtime');

const DirectBinaryUploadOptions = importFile('direct-binary-upload-options');
const proxyquire = require('proxyquire').noCallThru();
const should = require('should');

function getImportPath(file) {
    return `../src/${file}`;
}

module.exports.getImportPath = getImportPath;

/**
 * Requires a file from the project's src directory, applying a given set of
 * Mock objects to it.
 *
 * @param {string} file The path to the file to import, from the src/ directory. For example, "http-utils".
 * @param {object} fileMocks A lookup containing objects that should be mocked. The key should be the name
 *  of the module to Mock, and the value is the object to return when the mocked module is required. If
 *  the module is installed, the name can simply be the name of the module (such as "fs"). If the module
 *  is in the project, the name should be the relative path to the file from the src/ directory (such
 *  as "./upload-file").
 */
function importFile(file, fileMocks) {
    const requirePath = getImportPath(file);
    let required;
    if (fileMocks) {
        required = proxyquire(requirePath, fileMocks);
    } else {
        required = require(requirePath);
    }
    if (required && required.default) {
        return required.default;
    }
    return required;
}
module.exports.importFile = importFile;

function getConsoleLogger() {
    return {
        info: console.log,
        debug: console.log,
        warn: console.log,
        error: console.log
    }
}

/**
 * Retrieves a test logger that will print messages to console.log.
 */
module.exports.getConsoleLogger = getConsoleLogger;

/**
 * Retrieves high level direct binary options that provide the ability
 * to output logs based on the state of the AEM_UPLOAD_TEST_LOGGING
 * environment variable.
 * @returns {object} Options for a direct binary operation.
 */
module.exports.getTestOptions = (addlOptions = {}) => {
    if (process.env.AEM_UPLOAD_TEST_LOGGING) {
        return {
            ...addlOptions,
            log: getConsoleLogger(),
        }
    }
    return addlOptions;
}

/**
 * Retrieves high level direct binary upload options common for many tests.
 * @returns {object} Options for a direct binary upload operation.
 */
module.exports.getTestUploadOptions = () => {
    return new DirectBinaryUploadOptions()
        .withConcurrent(false)
        .withHeaders({
            hello: 'world!'
        })
        .withUploadFiles([{
            fileSize: 1024,
            fileName: 'file.jpg',
            filePath: '/my/test/file.jpg',
            createVersion: true,
            versionComment: 'My Comment',
            versionLabel: 'Version Label',
            replace: true,
            partHeaders: {
                part: 'header'
            }
        }, {
            fileSize: 2048,
            fileName: 'blob-file.jpg',
            blob: [1, 2, 3]
        }]);
}

// stores events for monitorEvents().
let events = [];

/**
 * Monitors all file-related events for the given upload process. This includes
 * "filestart", "fileprogress", "fileend", "fileerror", and "filecancelled".
 * @param {EventEmitter} toMonitor Emitter to monitor.
 */
module.exports.monitorEvents = (toMonitor) => {
    events = [];
    toMonitor.on('filestart', data => events.push({ event: 'filestart', data }));
    toMonitor.on('fileprogress', data => events.push({ event: 'fileprogress', data }));
    toMonitor.on('fileend', data => events.push({ event: 'fileend', data }));
    toMonitor.on('fileerror', data => events.push({ event: 'fileerror', data }));
    toMonitor.on('filecancelled', data => events.push({ event: 'filecancelled', data }));
    toMonitor.on('foldercreated', data => events.push({ event: 'foldercreated', data }));
}

/**
 * Determines if an event with a matching "targetFile" value was emitted since the
 * last invocation of monitorEvents(). If found, the event's other data values will
 * be validated.
 * @param {string} eventName Name of the expected event.
 * @param {string} targetFile Value of the "targetFile" event data property for the
 *  expected event.
 * @returns {object|boolean} The event's data if found, otherwise false.
 */
module.exports.getEvent = (eventName, targetFile) => {
    for (let i = 0; i < events.length; i++) {
        const { event, data } = events[i];

        if (event === eventName && data.targetFile === targetFile) {
            const { fileName, targetFolder } = data;
            const lastSlash = targetFile.lastIndexOf('/');
            const expectedFileName = targetFile.substr(lastSlash + 1);
            const expectedTargetFolder = targetFile.substr(0, lastSlash);
            should(fileName).be.exactly(expectedFileName);
            should(targetFolder).be.exactly(expectedTargetFolder);

            return data;
        }
    }
    return false;
}

/**
 * Determines if an event with a matching "targetFolder" value was emitted since the
 * last invocation of monitorEvents(). If found, the event's other data values will
 * be validated.
 * @param {string} eventName Name of the expected event.
 * @param {string} targetFolder Value of the "targetFolder" event data property for the
 *  expected event.
 * @returns {object|boolean} The event's data if found, otherwise false.
 */
module.exports.getFolderEvent = (eventName, targetFolder) => {
    for (let i = 0; i < events.length; i++) {
        const { event, data } = events[i];

        if (event === eventName && data.targetFolder === targetFolder) {
            const { folderName, targetParent } = data;
            const lastSlash = targetFolder.lastIndexOf('/');
            const expectedFolderName = targetFolder.substr(lastSlash + 1);
            const expectedTargetParent = targetFolder.substr(0, lastSlash);
            should(folderName).be.exactly(expectedFolderName);
            should(targetParent).be.exactly(expectedTargetParent);

            return data;
        }
    }
    return false;
}
