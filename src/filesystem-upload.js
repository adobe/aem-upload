import UploadBase from './upload-base';
import DirectBinaryUpload from './direct-binary-upload';
import fs from 'fs';
import path from 'path';
import rp from 'request-promise-native';

export default class FileSystemUpload extends UploadBase {
    async upload({ host, auth, targetFolder, fromArr }) {
        let fileList = this.getLocalFileArr(fromArr);

        const result = await this.createAemFolder(host, auth, targetFolder);
        if (!result) {
            this.logError(`Failed to create AEM target folder '${targetFolder}'`);
            return;
        }
        // start initiate uploading, single for all files
        let uploadArr = fileList.map((item) => {
            return {
                filePath: item.filePath,
                fileName: item.fileName,
                fileSize: item.fileSize,
            };
        });

        const directUpload = new DirectBinaryUpload(this.options);
        return await directUpload.uploadFiles(`${host}${targetFolder}`, { 'Authorization': auth }, uploadArr);
    }

    getLocalFileArr(fromArr) {
        let fileList = [];
        fromArr.forEach((item) => {
            if (!fs.existsSync(item)) {
                this.logWarn(`The specified '${item}' doesn't exists`);
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
                    subFileArr.forEach((fileName) => {
                        let filePath = path.join(item, fileName);
                        let subFileStat = fs.statSync(filePath);
                        if (subFileStat.isFile()) {
                            if (fileName.match(/^\./)) {
                                this.logDebug('Skip hidden file: ' + fileName);
                            } else {
                                let fileSize = subFileStat.size;
                                fileList.push({
                                    fileName: fileName,
                                    filePath: filePath,
                                    fileSize: fileSize
                                });
                            }
                        } else {
                            this.logDebug('Skip non file: ' + fileName);
                        }
                    });
                }
            }
        });

        this.logInfo('Local files for uploading: ' + JSON.stringify(fileList, null, 4));
        return fileList;
    }

    // create async func for creating AEM folder for easy reading
    // async is just a shortcut to create Promise result
    // compare to request, rp is just shortcut to create Promise
    // without using of async and rp, we could use native Promise instead
    async createAemFolder(host, auth, targetFolder) {
        try {
            await rp({
                url: host + targetFolder + '.0.json',
                method: 'GET',
                headers: {
                    'Authorization': auth
                }
            });
            this.logInfo(`AEM target folder '${targetFolder}' exists`);
            return true;
        } catch (error) {
            this.logInfo(`AEM target folder '${targetFolder}' doesnot exist, create it`);
        }

        try {
            await rp({
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
            this.logInfo(`AEM target folder '${targetFolder}' is created`);
        } catch (error) {
            this.logError(`Failed to create AEM target folder '${targetFolder}': + '${error}'`);
            return false;
        }
        return true;
    }
}
