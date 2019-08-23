#!/usr/bin/env node
import 'core-js/stable';
import 'regenerator-runtime';

import FileSystemUpload from './filesystem-upload';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import yargs from 'yargs';
import mustache from 'mustache';

let appRoot = path.join(__dirname, '../');

// 1. handle CLI parameters
const options = getArgv(yargs);
let { logFile, htmlResult } = options;

// 2. setup logger
const log = getLogger(winston);

// 3. handle local folder

const fileUpload = new FileSystemUpload({ log });
fileUpload.upload(options)
    .then((allUploadResult) => {
        log.info('finished uploading files');
        // generate html format result
        let mstTemplate = fs.readFileSync(appRoot + '/view/result.mst').toString();
        let htmlOutput = mustache.render(mstTemplate, allUploadResult);
        fs.writeFileSync(htmlResult, htmlOutput);
        log.info(`Uploading result is saved to html file '${htmlResult}'`);
    })
    .catch(err => {
        log.error('unhandled exception attempting to upload files', err);
    });

log.info(`Log file is saved to log file '${logFile}'`);

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
        .option('s', { alias: 'serial', describe: 'Upload files serially instead of concurrently', type: 'boolean', default: false })
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
    let serial = argv.serial;

    console.log(`Input skyline host:             ${host}`);
    console.log(`Input skyline target folder:    ${targetFolder}`);
    console.log(`Input from:                     ${fromArr}`);
    console.log(`Log file:                       ${logFile}`);
    console.log(`Html file:                      ${htmlResult}`);
    console.log(`Serial:                         ${serial}`);

    return {
        host: host,
        auth: auth,
        targetFolder: targetFolder,
        fromArr: fromArr,
        logFile: logFile,
        htmlResult: htmlResult,
        serial,
    };
}
