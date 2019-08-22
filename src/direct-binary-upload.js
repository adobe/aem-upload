import UploadBase from './upload-base';
import URL from 'url';
import rp from 'request-promise-native';
import fs from 'fs';
import path from 'path';
import filesize from 'filesize';
import querystring from 'querystring';

export default class DirectBinaryUpload extends UploadBase {
    async uploadFiles(targetUrl, defaultHeaders = {}, toUpload = []) {
        let veryStart = new Date().getTime();

        const {
            pathname: targetFolder,
            protocol,
            host,
        } = URL.parse(targetUrl);
        const urlPrefix = host ? `${protocol}//${host}` : '';
        const initOptions = {
            url: `${targetUrl}.initiateUpload.json`,
            method: 'POST',
            headers: {
                ...defaultHeaders,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: querystring.stringify({
                path: targetFolder,
                fileName: toUpload.map(item => item.fileName),
                fileSize: toUpload.map(item => item.fileSize),
            }),
            time: true,
            json: true,
            resolveWithFullResponse: true,
        };

        const response = await rp(initOptions);
        const {
            body: resObj,
            statusCode,
            elapsedTime,
        } = response;

        this.logInfo(`Finished initialize uploading, response code: '${statusCode}', time elapsed: '${elapsedTime}' ms`);

        this.logInfo('Init upload result: ' + JSON.stringify(resObj, null, 4));

        const {
            files: fileListInit,
            completeURI, // completeURI is per target folder
        } = resObj;

        const allUploadResult = {
            initSpend: elapsedTime,
            totalFiles: fileListInit.length,
        };

        let promiseArr = [];
        let uploadResults = [];
        for (let i = 0; i < fileListInit.length; i++) {
            let file = fileListInit[i];
            let uploadURIs = file.uploadURIs;
            let uploadToken = file.uploadToken;
            let fileName = file.fileName;
            let mimeType = file.mimeType;
            let maxPartSize = file.maxPartSize;
            let minPartSize = file.minPartSize;

            let fileSize = toUpload[i].fileSize;

            this.logInfo(`Start uploading '${fileName}' to cloud, fileSize: '${fileSize}', uriNum: '${uploadURIs.length}'`);

            let chunkArr = this.getChunkArr(uploadURIs, toUpload[i], minPartSize, maxPartSize);

            let uploadResult = {
                fileName,
                targetPath: path.join(targetFolder, fileName),
                fileSize: fileSize,
                fileSizeStr: filesize(fileSize),
                partSizeStr: filesize(chunkArr[0].partSize),
                partNum: chunkArr.length,

                putSpentFinal: 0,
                putSpentMin: 0,
                putSpentMax: 0,
                putSpentAvg: 0,
                completeSpent: 0,
                success: false,
                message: ''
            };

            let hrstart = new Date().getTime();
            const putResultArr = await this.uploadToCloud(chunkArr);
            let hrend = new Date().getTime();
            let finalSpentTime = hrend - hrstart;
            this.logInfo(`Finished uploading '${fileName}', took '${finalSpentTime}' ms`);
            let completeOptions = {
                url: `${urlPrefix}${completeURI}`,
                method: 'POST',
                headers: {
                    ...defaultHeaders,
                },
                qs: {
                    fileName: fileName,
                    mimeType: mimeType,
                    uploadToken: uploadToken
                },
                time: true,
                resolveWithFullResponse: true,
            };

            const response = await rp(completeOptions);
            let spentArr = putResultArr.map((putResult) => {
                return putResult.putSpent;
            });
            let spentSum = spentArr.reduce((x, y) => x += y);
            let spentAvg = Math.round(spentSum / spentArr.length);

            uploadResult.putSpentFinal = finalSpentTime;
            uploadResult.putSpentMin = Math.min(...spentArr);
            uploadResult.putSpentMax = Math.max(...spentArr);
            uploadResult.putSpentAvg = spentAvg;
            uploadResult.completeSpent = response.elapsedTime;
            uploadResult.success = true;
            uploadResults.push(uploadResult);
            this.logInfo(`Finished complete uploading '${fileName}', response code: '${response.statusCode}', time elapsed: '${response.elapsedTime}' ms`);
        };

        return this.generateResult(allUploadResult, veryStart, uploadResults);
    }

    // upload to cloud, this is per asset, support mutliple parts
    async uploadToCloud(chunkArr) {
        const results = [];
        for (let i = 0; i < chunkArr.length; i += 1) {
            const {
                partBody,
                partSize,
                uploadUrl,
                fileName,
                partIndex,
             } = chunkArr[i];

            const response = await rp({
                url: uploadUrl,
                method: 'PUT',
                headers: {
                    'Content-Length': partSize
                },
                body: partBody,
                time: true,
                resolveWithFullResponse: true,
            });

            const {
                statusCode,
                elapsedTime,
            } = response;

            this.logInfo(`Put upload part done for file: '${fileName}', partIndex: '${partIndex}', partSize: '${partSize}', spent: '${elapsedTime}' ms, status: ${statusCode}`);

            results.push({
                ...chunkArr[i],
                putSpent: elapsedTime,
            })
        }

        return results;
    }

    getChunkArr(uploadURIs, fileInfo, minPartSize, maxPartSize) {
        const { fileName, fileSize } = fileInfo;
        if (maxPartSize > 0) {
            const numParts = Math.ceil(fileSize / maxPartSize);
            if (numParts > uploadURIs.length) {
                throw `number of parts (${numParts}) is more than the number of available part urls (${urls.length})`;
            }
        }

        let urlNum = uploadURIs.length;
        let partSize;
        // if file size is less than minimum part size, use the file's size
        if (fileSize < minPartSize) {
            partSize = fileSize;
            if (urlNum !== 1) {
                throw `fileSize less than min part size must only have one url`;
            }
        } else {
            // calculate part size based on number of urls
            partSize = Math.floor((fileSize + urlNum - 1) / urlNum);
            // if average partSize is smaller than minPartSize, use minPartSize instead
            if (partSize < minPartSize) {
                partSize = minPartSize;
                this.logDebug(`Calculated part size ${partSize} is less than min part size ${minPartSize}, so set the partSize with minPartSize`);
            }
        }
        this.logDebug(`Multipart upload part size for file '${fileName}' is ${partSize}`);

        let chunkArr = [];
        for (let index = 0; index < uploadURIs.length; index++) {
            let uploadUrl = uploadURIs[index];

            const start = index * partSize;
            let end = start + partSize;
            if (end > fileSize) {
                end = fileSize;
            }
            this.logDebug(`Generate uploading part for file '${fileName}', index: '${index}', file range: '${start} - ${end}'`);
            let chunk = {
                fileName: fileName,
                partSize: (end - start),
                partIndex: index,
                partBody: this.getFileChunk(fileInfo, start, end),
                uploadUrl: uploadUrl
            }
            chunkArr.push(chunk);
        }
        return chunkArr;
    }

    getFileChunk(file, start, end) {
        const {
            filePath,
            blob,
        } = file;

        if (filePath) {
            return fs.createReadStream(filePath, { start, end });
        } else if (blob && blob.slice) {
            return blob.slice(start, end);
        } else {
            throw 'unsupported operation: file must have a filePath or blob';
        }
    }

    generateResult(allUploadResult, veryStart, result) {
        allUploadResult.detailedResult = result;

        let successUploadResultArr = result.filter(function (item) {
            return (item.success === true);
        });
        let successUploadNum = successUploadResultArr.length;

        // totalCompleted
        allUploadResult.totalCompleted = successUploadNum;

        // finalSpent
        let veryEnd = new Date().getTime();
        let finalSpent = veryEnd - veryStart;
        allUploadResult.finalSpent = finalSpent;

        if (successUploadNum > 0) {
            // totalFileSize, avgFileSize
            let fileSizeArr = successUploadResultArr.map((item) => {
                return item.fileSize;
            });
            let totalFileSize = fileSizeArr.reduce((x, y) => x += y);
            allUploadResult.totalFileSize = filesize(totalFileSize);
            allUploadResult.avgFileSize = filesize(Math.round(totalFileSize / successUploadNum));

            // avgPutSpent
            let putSpentArr = successUploadResultArr.map((item) => {
                return item.putSpentFinal;
            });
            let sumPutSpent = putSpentArr.reduce((x, y) => x += y);
            allUploadResult.avgPutSpent = Math.round(sumPutSpent / successUploadNum);

            // avgCompleteSpent
            let completeSpentArr = successUploadResultArr.map((item) => {
                return item.completeSpent;
            });
            let sumCompleteSpent = completeSpentArr.reduce((x, y) => x += y);
            allUploadResult.avgCompleteSpent = Math.round(sumCompleteSpent / successUploadNum);

            // 90 percentile put+complete
            let totalSpentArr = successUploadResultArr.map((item) => {
                return item.putSpentFinal + item.completeSpent;
            });
            let sortedTotalSpentArr = totalSpentArr.sort((x, y) => x - y);
            let nintyPercentileIndex = Math.round(successUploadNum * 0.9) - 1;
            allUploadResult.nintyPercentileTotal = sortedTotalSpentArr[nintyPercentileIndex];
        }

        // output json result to logger
        this.logInfo('Uploading result in JSON: ' + JSON.stringify(allUploadResult, null, 4));

        return allUploadResult;
    }
}
