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

/**
 * The error codes that the upload process might provide to the consumer.
 */
export default {
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
};