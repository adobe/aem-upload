/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import should from 'should';
import Exports from '../src/exports';
import { DirectBinaryUploadOptions } from '../src/exports';

describe('Exports Tests', function() {

    it('test exports smoke test', function() {
        should(Exports).be.ok();
        should(Exports.DirectBinaryUploadOptions).be.ok();
        should(DirectBinaryUploadOptions).be.ok();

        should(new Exports.DirectBinaryUploadOptions()).be.ok();
        should(new DirectBinaryUploadOptions()).be.ok();
    });

});
