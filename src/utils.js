import axios from 'axios';

export async function timedRequest(requestOptions) {
    const reqStart = new Date().getTime();
    const response = await axios(requestOptions);
    response.elapsedTime = new Date().getTime() - reqStart;
    return response;
}

export function concurrentLoop(loopArray, itemCallback) {
    const promiseArr = [];
    for (let i = 0; i < loopArray.length; i++) {
        promiseArr.push(itemCallback(loopArray[i], i));
    }
    return Promise.all(promiseArr);
}

export async function serialLoop(loopArray, itemCallback) {
    const itemResults = [];
    for (let i = 0; i < loopArray.length; i++) {
        itemResults.push(await itemCallback(loopArray[i], i));
    }
    return itemResults;
}
