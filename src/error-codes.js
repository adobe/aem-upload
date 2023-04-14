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

/**
 * The error codes that the upload process might provide to the consumer.
 */
module.exports = {
  /**
   * The "catch all" error code that is used in cases where the specific error type cannot
   * be determined.
   */
  UNKNOWN: 'EUNKNOWN',

  /**
   * Used when some entity in the upload process could not be located.
   */
  NOT_FOUND: 'ENOTFOUND',

  /**
   * Used when the target instance does not support direct binary upload.
   */
  NOT_SUPPORTED: 'ENOTSUPPORTED',

  /**
   * Used when the options provided by the consumer were insufficient to perform the upload.
   */
  INVALID_OPTIONS: 'EINVALIDOPTIONS',

  /**
   * Sent when the consumer has insufficient access to perform the upload.
   */
  NOT_AUTHORIZED: 'ENOTAUTHORIZED',

  /**
   * Indicates an unexpected state in the target API.
   */
  UNEXPECTED_API_STATE: 'EUNEXPECTEDAPISTATE',

  /**
   * An attempt was made to create an item that already exists.
   */
  ALREADY_EXISTS: 'EALREADYEXISTS',

  /**
   * The user is forbidden from modifying the requested target.
   */
  FORBIDDEN: 'EFORBIDDEN',

  /**
   * The user cancelled an operation.
   */
  USER_CANCELLED: 'EUSERCANCELLED',

  /**
   * Payload provided by user is too large.
   */
  TOO_LARGE: 'ETOOLARGE',
};
