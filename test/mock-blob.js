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

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const Readable = require('stream').Readable;

function MockBlob() {
    EventEmitter.call(this);
    this.slices = [];
}

util.inherits(MockBlob, EventEmitter);

MockBlob.prototype.getSlices = function() {
    return this.slices;
}

MockBlob.prototype.slice = function(start, end) {
    const data = `${start},${end},`;
    let called = false;

    this.slices.push({ start, end });

    const slice = new Readable({
        read() {
            if (!called) {
                this.push(data);
                called = true;
            } else {
                this.push(null);
            }
        }
    });

    slice.mockData = data;

    return slice;
}

module.exports = MockBlob;
