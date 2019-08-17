#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const request = require('request');
const rp = require('request-promise-native');
const winston = require('winston');
const yargs = require('yargs');
const mustache = require('mustache');
const filesize = require('filesize');

// 1. handle CLI parameters
let { host, auth, targetFolder, localFolder, logFile, htmlResult } = getArgv(yargs);

// 2. setup logger
const log = getLogger(winston);

// 3. handle local folder
if (!fs.existsSync(localFolder)) {
    log.error(`The folder specified '${localFolder}' doesn't exists`);
    return;
}
let { fileNameArr, fileSizeArr, fileListObj } = getLocalFiles(localFolder);

let overAllResult = {};
let veryStart = process.hrtime();

createAemFolder(host, auth, targetFolder).then(function (result) {
    if (!result) {
        log.error(`Failed to create AEM target folder '${targetFolder}'`);
        return;
    }
    // let totalFileSize = fileSizeArr.reduce((x, y) => x += y);
    // 3.1 start initiate uploading, single for all files
    let initOptions = {
        url: host + targetFolder + '.initiateUpload.json',
        method: 'POST',
        headers: {
            'Authorization': auth
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
        overAllResult.initSpent = response.elapsedTime;
        let resObj = JSON.parse(body);
        let files = resObj.files;
        // completeURI is per target folder
        let completeURI = resObj.completeURI;
        overAllResult.totalFiles = files.length;

        let promiseArr = [];
        files.forEach(function (file) {
            let uploadURIs = file.uploadURIs;
            let uploadToken = file.uploadToken;
            let fileName = file.fileName;
            let mimeType = file.mimeType;
            let maxPartSize = file.maxPartSize;
            let minPartSize = file.minPartSize;

            let fileSize = fileListObj[fileName].fileSize;
            let filePath = fileListObj[fileName].filePath;

            log.info(`Start uploading '${filePath}' to cloud, fileSize: '${fileSize}', uriNum: '${uploadURIs.length}'`);

            let chunkArr = getChunkArr(uploadURIs, filePath, fileSize, minPartSize, maxPartSize);

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
                            'Authorization': auth
                        },
                        qs: {
                            fileName: fileName,
                            mimeType: mimeType,
                            uploadToken: uploadToken
                        },
                        time: true
                    };
                    request(completeOptions, function (error, response, body) {
                        let spentArr = putResultArr.map((putResult) => {
                            return putResult.putSpent;
                        });
                        let spentSum = spentArr.reduce((x, y) => x += y);
                        let spentAvg = Math.round(spentSum / spentArr.length);
                        var uploadResult = {
                            filePath: filePath,
                            targetPath: completeURI.replace('.completeUpload.json', '/') + fileName,
                            fileSize: fileSize,
                            fileSizeStr: filesize(fileSize),
                            partSize: chunkArr[0].fileSize,
                            partNum: chunkArr.length,
                            putSpentFinal: finalSpentTime,
                            putSpentMin: Math.min(...spentArr),
                            putSpentMax: Math.max(...spentArr),
                            putSpentAvg: spentAvg,
                            completeSpent: response.elapsedTime
                        };
                        log.info(`Finished complete uploading '${filePath}', response code: '${response.statusCode}', time elapsed: '${response.elapsedTime}' ms`);
                        resolve(uploadResult);
                    });
                });
            });
            promiseArr.push(completePromise);
        });

        Promise.all(promiseArr).then(function (result) {
            generateResult(result);
        });
    });
});

function getLogger(winston) {
    const { combine, timestamp, label, printf } = winston.format;
    const myFormat = printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
    });
    const log = winston.createLogger({
        format: combine(
            label({ label: '' }),
            timestamp(),
            myFormat
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({ filename: 'upload.log' })
        ]
    });

    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));


    return log;
}

function getArgv(yargs) {
    let currentTimeStr = new Date().getTime();
    const argv = yargs
        .usage('Usage: skyline_upload [options] folder')
        .option('h', { alias: 'host', describe: 'Skyline host', type: 'string', default: 'http://localhost:4502' })
        .option('c', { alias: 'credential', describe: 'Skyline credential', type: 'string', default: 'admin:admin' })
        .option('t', { alias: 'target', describe: 'Skyline target folder', type: 'string', default: '/content/dam/skyline-upload-' + currentTimeStr })
        .option('l', { alias: 'log', describe: 'Log file path', type: 'string', default: 'upload-' + currentTimeStr + '.log' })
        .option('o', { alias: 'output', describe: 'Result html file path', type: 'string', default: 'result-' + currentTimeStr + '.html' })
        .demandCommand(1)
        .argv;

    let host = argv.host;
    let credential = argv.credential;
    let targetFolder = argv.target;
    let logFile = argv.log;
    let htmlResult = argv.output;
    let localFolder = argv._[0];
    let auth = 'Basic ' + Buffer.from(credential).toString('base64');

    console.log(`Input skyline host:             ${host}`);
    console.log(`Input skyline target folder:    ${targetFolder}`);
    console.log(`Input local folder:             ${localFolder}`);
    console.log(`Log file:                       ${logFile}`);
    console.log(`Html file:                      ${htmlResult}`);

    return {
        host: host,
        auth: auth,
        targetFolder: targetFolder,
        localFolder: localFolder,
        logFile: logFile,
        htmlResult: htmlResult
    };
}

function getLocalFiles(localFolder) {
    let fileNameArr = [];
    let fileSizeArr = [];
    let fileListObj = {};
    let files = fs.readdirSync(localFolder);
    files.forEach(function (fileName) {
        let fileStat = fs.statSync(path.join(localFolder, fileName));
        if (fileStat.isFile()) {
            if (fileName.match(/^\./)) {
                log.debug('Skip hidden file: ' + fileName);
            } else {
                let fileSize = fileStat.size;

                fileSizeArr.push(fileSize);
                fileNameArr.push(fileName);

                fileListObj[fileName] = {
                    filePath: path.join(localFolder, fileName),
                    fileSize: fileSize
                };
            }
        } else {
            log.debug('Skip non file: ' + fileName);
        }
    });
    log.info('Local files for uploading: ' + fileNameArr);
    return {
        fileNameArr: fileNameArr,
        fileSizeArr: fileSizeArr,
        fileListObj: fileListObj
    }
}

// create async func for creating AEM folder for easy reading
// async is just a shortcut to create Promise result
// compare to request, rp is just shortcut to create Promise
// without using of async and rp, we could use native Promise instead
async function createAemFolder(host, auth, targetFolder) {
    try {
        let result = await rp({
            url: host + targetFolder + '.0.json',
            method: 'GET',
            headers: {
                'Authorization': auth
            }
        });
        log.info(`AEM target folder '${targetFolder}' exists`);
        return true;
    } catch (err) {
        log.info(`AEM target folder '${targetFolder}' doesnot exist, create it`);
    }

    try {
        let result = await rp({
            url: host + targetFolder,
            method: 'POST',
            headers: {
                'Authorization': auth
            },
            qs: {
                './jcr:content/jcr:title': path.basename(targetFolder),
                ':name': path.basename(targetFolder),
                './jcr:primaryType': 'sling:Folder',
                './jcr:content/jcr:primaryType': 'nt:unstructured',
                '_charset_': 'UTF-8'
            }
        });
        log.info(`AEM target folder '${targetFolder}' is created`);
    } catch (err) {
        log.error(`Failed to create AEM target folder '${targetFolder}': + '${err}'`);
        return false;
    }
    return true;
}

function getChunkArr(uploadURIs, filePath, fileSize, minPartSize, maxPartSize) {
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
        if (partSize < minPartSize) {
            partSize = minPartSize;
            log.debug(`Calculated part size ${partSize} is less than min part size ${minPartSize}, so set the partSize with minPartSize`);
        }
    }
    log.debug(`Multipart upload part size for file '${filePath}' is ${partSize}`);

    let chunkArr = [];
    for (let index = 0; index < uploadURIs.length; index++) {
        let uploadUrl = uploadURIs[index];

        const start = index * partSize;
        let end = start + partSize;
        if (end > fileSize) {
            end = fileSize;
        }
        log.debug(`Generate uploading part for file '${filePath}', index: '${index}', file range: '${start} - ${end}'`);
        let chunk = {
            filePath: filePath,
            partSize: (end - start),
            partIndex: index,
            partBody: fs.createReadStream(filePath, { start, end }),
            uploadUrl: uploadUrl
        }
        chunkArr.push(chunk);
    }
    return chunkArr;
}

// upload to cloud, this is per asset, support mutliple part
function uploadToCloud(chunkArr, result) {
    return Promise.all(chunkArr.map(function (chunk) {
        return new Promise(function (resolve, reject) {
            let partBody = chunk.partBody;
            let partSize = chunk.partSize;
            let uploadUrl = chunk.uploadUrl;

            request({
                url: uploadUrl,
                method: 'PUT',
                headers: {
                    'Content-Length': partSize
                },
                body: partBody,
                time: true
            }, function (err, response, body) {
                if (err) {
                    log.error('upload failed', err);
                    reject(`HTTP PUT upload of chunk failed with ${err}`);
                } else if (response.statusCode >= 300) {
                    log.error('upload failed with', response.statusCode);
                    log.error(body);
                    reject(`HTTP PUT upload of chunk with ${response.statusCode}. Body: ${body}`);
                } else {
                    let putResult = Object.assign({}, chunk);
                    // let putResult = JSON.parse(JSON.stringify(chunk));
                    putResult.putSpent = response.elapsedTime;
                    log.info(`Put upload part done for file: '${putResult.filePath}', partIndex: '${putResult.partIndex}', partSize: '${putResult.partSize}', spent: '${putResult.putSpent}' ms`);
                    resolve(putResult);
                }
            });
        }).catch((err) => {
            throw new GenericError(err, 'upload_error');
        })
    }));
}

function generateResult(result) {
    overAllResult.detailedResult = result;

    let fileSizeArr = result.map((item) => {
        return item.fileSize;
    });
    let totalFileSize = fileSizeArr.reduce((x, y) => x += y);
    overAllResult.totalFileSize = filesize(totalFileSize);
    overAllResult.avgFileSize = filesize(Math.round(totalFileSize / result.length));

    overAllResult.totalCompleted = result.length;
    let veryEnd = process.hrtime(veryStart);
    let finalSpent = Math.round(veryEnd[0] * 1000 + veryEnd[1] / 1000000);
    overAllResult.finalSpent = finalSpent;

    let putSpentArr = result.map((item) => {
        return item.putSpentFinal;
    });
    let sumPutSpent = putSpentArr.reduce((x, y) => x += y);
    overAllResult.avgPutSpent = Math.round(sumPutSpent / result.length);

    let completeSpentArr = result.map((item) => {
        return item.completeSpent;
    });
    let sumCompleteSpent = completeSpentArr.reduce((x, y) => x += y);
    overAllResult.avgCompleteSpent = Math.round(sumCompleteSpent / result.length);
    log.info('Uploading result in JSON:');
    log.info(JSON.stringify(overAllResult, null, 4));

    log.info(`Uploading result is also saved to html file '${htmlResult}'`);

    let template = fs.readFileSync('view/result.mst').toString()
    let htmlOutput = mustache.render(template, overAllResult);
    fs.writeFileSync(htmlResult, htmlOutput);
}