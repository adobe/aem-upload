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

const proxyquire = require('proxyquire').noCallThru();

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
module.exports.importFile = (file, fileMocks) => {
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

/**
 * Retrieves a test logger that will print messages to console.log.
 */
module.exports.getConsoleLogger = () => {
    return {
        info: console.log,
        debug: console.log,
        warn: console.log,
        error: console.log
    }
}
