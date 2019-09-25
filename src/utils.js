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
 * Loops through a given array, concurrently invoking the given callback.
 *
 * @param {Array} loopArray Array to loop through.
 * @param {function} itemCallback Invoked each time an item from the given array is available. Will
 *  be invoked with two parameters: the item itself and the index of the item in the array. The
 *  return value of this callback is expected to be a Promise.
 * @returns {Promise} Will be resolved when all Promises returned by the callback have been resolved.
 *  Will be resolved with an Array of all resolve values from the callback's Promises.
 */
export function concurrentLoop(loopArray, itemCallback) {
    const promiseArr = [];
    for (let i = 0; i < loopArray.length; i++) {
        promiseArr.push(itemCallback(loopArray[i], i));
    }
    return Promise.all(promiseArr);
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
