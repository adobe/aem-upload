import URL from 'url';

export default class DirectBinaryUpload {
    constructor(options = {}) {
        this.options = options;
    }

    async uploadFiles(targetUrl, defaultHeaders = {}) {
        const { pathname: targetFolder } = URL.parse(targetUrl);
        const initOptions = {
            url: `${targetUrl}.initiateUpload.json`,
            method: 'POST',
            headers: {
                ...defaultHeaders,
            },
            qs: {
                path: targetFolder,
                fileName: fileNameArr,
                fileSize: fileSizeArr
            },
            qsStringifyOptions: { indices: false },
            time: true
        };
        request(initOptions, function (error, response, body) {
            log.info(`Finished initialize uploading, response code: '${response.statusCode}', time elapsed: '${response.elapsedTime}' ms`);
            allUploadResult.initSpent = response.elapsedTime;
            let resObj = JSON.parse(body);
            log.info('Init upload result: ' + JSON.stringify(resObj, null, 4));

            let fileListInit = resObj.files;

            // completeURI is per target folder
            let completeURI = resObj.completeURI;
            allUploadResult.totalFiles = fileListInit.length;

            let promiseArr = [];
            for (let i = 0; i < fileListInit.length; i++) {
                let file = fileListInit[i];
                let uploadURIs = file.uploadURIs;
                let uploadToken = file.uploadToken;
                let fileName = file.fileName;
                let mimeType = file.mimeType;
                let maxPartSize = file.maxPartSize;
                let minPartSize = file.minPartSize;

                let fileSize = fileList[i].fileSize;
                let filePath = fileList[i].filePath;

                log.info(`Start uploading '${filePath}' to cloud, fileSize: '${fileSize}', uriNum: '${uploadURIs.length}'`);

                let chunkArr = getChunkArr(uploadURIs, filePath, fileSize, minPartSize, maxPartSize);

                let uploadResult = {
                    filePath: filePath,
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

                let hrstart = process.hrtime();
                let completePromise = new Promise(function (resolve, reject) {
                    uploadToCloud(chunkArr).then(function (putResultArr) {
                        let hrend = process.hrtime(hrstart);
                        let finalSpentTime = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                        log.info(`Finished uploading '${fileName}', took '${finalSpentTime}' ms`);
                        let completeOptions = {
                            url: host + completeURI,
                            method: 'POST',
                            headers: {
                                ...defaultHeaders,
                            },
                            qs: {
                                fileName: fileName,
                                mimeType: mimeType,
                                uploadToken: uploadToken
                            },
                            time: true
                        };
                        request(completeOptions, function (error, response, body) {
                            if (response.statusCode === 200) {
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
                                log.info(`Finished complete uploading '${filePath}', response code: '${response.statusCode}', time elapsed: '${response.elapsedTime}' ms`);
                            } else {
                                uploadResult.message = 'complete upload error ' + response.statusCode + error;
                            }
                            resolve(uploadResult);
                        });
                    }).catch(function (error) {
                        log.error(`Failed to put upload file '${filePath}' to cloud`);
                        uploadResult.message = 'put upload error: ' + error;
                        resolve(uploadResult);
                    });
                });
                promiseArr.push(completePromise);
            };

            Promise.all(promiseArr).then(function (result) {
                generateResult(result);
            });
        });
    }
}
