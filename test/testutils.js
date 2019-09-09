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

require('core-js');
require('regenerator-runtime');

const proxyquire = require('proxyquire');

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
    const requirePath = `../src/${file}`;
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
