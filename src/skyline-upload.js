#!/usr/bin/env node

import DirectBinaryUpload from './direct-binary-upload';

const fs = require('fs');
const path = require('path');
const request = require('request');
const rp = require('request-promise-native');
const winston = require('winston');
const yargs = require('yargs');
const mustache = require('mustache');
const filesize = require('filesize');

let appRoot = path.dirname(require.main.filename);

// 1. handle CLI parameters
let { host, auth, targetFolder, fromArr, logFile, htmlResult } = getArgv(yargs);

// 2. setup logger
const log = getLogger(winston);

// 3. handle local folder
let fileList = getLocalFileArr(fromArr);

let allUploadResult = {
    host: host,
    initSpent: 0,
    totalFiles: 0,
    totalCompleted: 0,
    finalSpent: 0,
    totalFileSize: 0,
    avgFileSize: 0,
    avgPutSpent: 0,
    avgCompleteSpent: 0,
    nintyPercentileTotal: 0
};

let veryStart = process.hrtime();

createAemFolder(host, auth, targetFolder).then(function (result) {
    if (!result) {
        log.error(`Failed to create AEM target folder '${targetFolder}'`);
        return;
    }
    // start initiate uploading, single for all files
    let fileNameArr = fileList.map((item) => {
        return item.fileName;
    });
    let fileSizeArr = fileList.map((item) => {
        return item.fileSize;
    });

    const directUpload = new DirectBinaryUpload();
    directUpload.uploadFiles(`${host}${targetFolder}`, { 'Authorization': auth });
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
            new winston.transports.File({ filename: logFile })
        ]
    });
    return log;
}

function getArgv(yargs) {
    let currentTimeStr = new Date().getTime();
    const argv = yargs
        .usage('Usage: skyline-upload [options] files&folder...')
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
    if (!targetFolder.startsWith('/content/dam')) {
        targetFolder = path.join('/content/dam', targetFolder);
    }
    let logFile = argv.log;
    let htmlResult = argv.output;
    let fromArr = argv._;
    let auth = 'Basic ' + Buffer.from(credential).toString('base64');

    console.log(`Input skyline host:             ${host}`);
    console.log(`Input skyline target folder:    ${targetFolder}`);
    console.log(`Input from:                     ${fromArr}`);
    console.log(`Log file:                       ${logFile}`);
    console.log(`Html file:                      ${htmlResult}`);

    return {
        host: host,
        auth: auth,
        targetFolder: targetFolder,
        fromArr: fromArr,
        logFile: logFile,
        htmlResult: htmlResult
    };
}

function getLocalFileArr(fromArr) {
    let fileList = [];
    fromArr.forEach(function (item) {
        if (!fs.existsSync(item)) {
            log.warn(`The specified '${item}' doesn't exists`);
        } else {
            let fileStat = fs.statSync(item);
            if (fileStat.isFile()) {
                let fileName = path.basename(item);
                let fileSize = fileStat.size;
                fileList.push({
                    fileName: fileName,
                    filePath: item,
                    fileSize: fileSize
                });
            } else if (fileStat.isDirectory()) {
                let subFileArr = fs.readdirSync(item);
                subFileArr.forEach(function (fileName) {
                    let filePath = path.join(item, fileName);
                    let subFileStat = fs.statSync(filePath);
                    if (subFileStat.isFile()) {
                        if (fileName.match(/^\./)) {
                            log.debug('Skip hidden file: ' + fileName);
                        } else {
                            let fileSize = subFileStat.size;
                            fileList.push({
                                fileName: fileName,
                                filePath: filePath,
                                fileSize: fileSize
                            });
                        }
                    } else {
                        log.debug('Skip non file: ' + fileName);
                    }
                });
            }
        }
    });

    log.info('Local files for uploading: ' + JSON.stringify(fileList, null, 4));
    return fileList;
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
    } catch (error) {
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
    } catch (error) {
        log.error(`Failed to create AEM target folder '${targetFolder}': + '${error}'`);
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
        // if average partSize is smaller than minPartSize, use minPartSize instead
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

// upload to cloud, this is per asset, support mutliple parts
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
            }, function (error, response, body) {
                if (error) {
                    log.error('upload failed', error);
                    reject(`HTTP PUT upload of chunk failed with ${error}`);
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
        }).catch((error) => {
            throw new GenericError(error, 'upload_error');
        });
    }));
}

function generateResult(result) {
    allUploadResult.detailedResult = result;

    let successUploadResultArr = result.filter(function (item) {
        return (item.success === true);
    });
    let successUploadNum = successUploadResultArr.length;

    // totalCompleted
    allUploadResult.totalCompleted = successUploadNum;

    // finalSpent
    let veryEnd = process.hrtime(veryStart);
    let finalSpent = Math.round(veryEnd[0] * 1000 + veryEnd[1] / 1000000);
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
    log.info('Uploading result in JSON: ' + JSON.stringify(allUploadResult, null, 4));

    // generate html format result
    let mstTemplate = fs.readFileSync(appRoot + '/view/result.mst').toString();
    let htmlOutput = mustache.render(mstTemplate, allUploadResult);
    fs.writeFileSync(htmlResult, htmlOutput);
    log.info(`Uploading result is saved to html file '${htmlResult}'`);

    log.info(`Log file is saved to log file '${logFile}'`);
}