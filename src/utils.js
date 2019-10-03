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

import Async from 'async';

import { DefaultValues } from './constants';

/**
 * Loops through a given array, concurrently invoking the given callback. The loop will have a maximum
 * number of pending itemCallbacks at any one time. For example, if there are 100 items in the array
 * and 5 itemCallbacks are currently processing, then no more itemCallbacks will be invoked until
 * at least one of the pending itemCallbacks completes.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {number} [maxConcurrent] Optionally specify how many concurrent itemCallbacks are allowed.
 *  Default is 5.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been resolved.
 *  Will be resolved with an Array of all resolve values from the callback's Promises.
 */
export function concurrentLoop(loopArray, maxConcurrent, itemCallback) {
    let theMaxConcurrent = maxConcurrent;
    let theItemCallback = itemCallback;
    if (typeof maxConcurrent === 'function') {
        theItemCallback = maxConcurrent;
        theMaxConcurrent = DefaultValues.MAX_CONCURRENT;
    }

    return new Promise((resolve, reject) => {
        Async.eachOfLimit(loopArray, theMaxConcurrent, async (loopItem, index, itemDone) => {
            try {
                await theItemCallback(loopItem, index);
            } catch (e) {
                itemDone(e);
                return;
            }
            itemDone();
        }, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

/**
 * Loops through a given array, moving on to the next item in the array only when the Promise for
 * the current item has resolved.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been resolved.
 *  Will be resolved with an Array of all resolve values from the callback's Promises.
 */
export async function serialLoop(loopArray, itemCallback) {
    const itemResults = [];
    for (let i = 0; i < loopArray.length; i++) {
        itemResults.push(await itemCallback(loopArray[i], i));
    }
    return itemResults;
}

/**
 * Calculates the average of all the numbers in an array.
 *
 * @param {Array} values List of numbers for which to calculate an average.
 * @returns {number} The average value, rounded to zero decimal places.
 */
export function getAverage(values) {
    if (values.length) {
        const sum = values.reduce((x, y) => x + y);
        return Math.round(sum / values.length);
    }
    return 0;
}
