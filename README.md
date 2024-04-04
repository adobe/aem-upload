- [Background](#background)
- [Command Line](#command-line)
- [Usage](#usage)
  - [Install](#install)
  - [Requiring the Module](#requiring-the-module)
  - [Uploading Files](#uploading-files)
    - [Supported Options](#supported-options)
      - [Direct binary upload options](#direct-binary-upload-options)
      - [Upload File Options](#upload-file-options)
    - [Error Handling](#error-handling)
    - [Upload Events](#upload-events)
      - [Upload Session Data](#upload-session-data)
      - [Folder Event Data](#folder-event-data)
      - [File Event Data](#file-event-data)
      - [File Progress Event Data](#file-progress-event-data)
      - [File Error Event Data](#file-error-event-data)
      - [Error Event Data](#error-event-data)
  - [Uploading Local Files](#uploading-local-files)
    - [Supported File Options](#supported-file-options)
  - [Logging](#logging)
  - [Proxy Support](#proxy-support)
- [Features](#features)
- [Releasing](#releasing)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [Maintainers](#maintainers)

# Background

In AEM Assets 6.5 and prior, a single post request to a servlet that manges asset binaries is enough for uploading files. Newer versions of AEM can be configured 
to use direct binary upload, which means that asset binaries are no longer uploaded straight to AEM. Because of this there is a more complex 
algorithm to follow when uploading asset binaries. This library will check the configuration of the target AEM instance, and will either use the direct binary upload algorithm or the create asset servlet, depending on the configuration.

This tool is provided for making uploading easier, and can be used as a command line executable
or required as a Node.js module.

![](doc/aem-fastingest-nui-architecture-overview.png)

# Command Line

A command line tool for for uploading assets to an AEM instance is available as a plugin for the Adobe I/O CLI. Please
see the [plugin repository](https://github.com/adobe/aio-cli-plugin-aem) for more information.

# Usage

This library supports uploading files to a target instance, while providing support for monitoring
transfer progress, cancelling transfers, and other features.

## Install

This project uses [node](http://nodejs.org) and [npm](https://npmjs.com). Go check them out if you don't have them locally installed.

It can be installed like any other Node.js module.

```sh
$ npm install @adobe/aem-upload
```

## Requiring the Module

To add the module to your Node.js project:

1. [Install](#install) the module in your project.
1. Require the module in the javascript file where it will be consumed:

```javascript
const DirectBinary = require('@adobe/aem-upload');
```

## Uploading Files

Following is the minimum amount of code required to upload files to a target AEM instance.

```javascript
const DirectBinary = require('@adobe/aem-upload');

// URL to the folder in AEM where assets will be uploaded. Folder
// must already exist.
const targetUrl = 'http://localhost:4502/content/dam/target';

// list of all local files that will be uploaded.
const uploadFiles = [
    {
        fileName: 'file1.jpg', // name of the file as it will appear in AEM
        fileSize: 1024, // total size, in bytes, of the file
        filePath: '/Users/me/Documents/my_file.jpg' // Full path to the local file
    },
    {
        fileName: 'file2.jpg',
        fileSize: 512,
        filePath: '/Users/me/Documents/file2.jpg'
    }
];

const upload = new DirectBinary.DirectBinaryUpload();
const options = new DirectBinary.DirectBinaryUploadOptions()
    .withUrl(targetUrl)
    .withUploadFiles(uploadFiles);

// this call will upload the files. The method returns a Promise, which will be resolved
// when all files have uploaded.
upload.uploadFiles(options)
    .then(result => {
        // "result" contains various information about the upload process, including
        // performance metrics and errors that may have occurred for individual files

        // at this point, assuming no errors, there will be two new assets in AEM:
        //  http://localhost:4502/content/dam/target/file1.jpg
        //  http://localhost:4502/content/dam/target/file2.jpg
    })
    .catch(err => {
        // the Promise will reject if something causes the upload process to fail at
        // a high level. Note that individual file failures will NOT trigger this

        // "err" will be an instance of UploadError. See "Error Handling"
        // for more information
    });
```

### Supported Options

#### Direct binary upload options

The `DirectBinaryUploadOptions` class supports the following options.

| Option | Required | Description |
| ------ | ---- | ----------- |
| `withUrl(<string>)` | Y | Full, absolute URL to the Folder in the target instance where the specified files will be uploaded. This value is expected to be URI encoded. |
| `withUploadFiles(<UploadFile[]>)` | Y | List of files that will be uploaded to the target URL. Each item in the array should be a simple object with the properties described in an [UploadFile](#upload-file-options). |
| `withHttpOptions(<object>)` | N | Consumers can control the options that the library will provide to the Fetch API when submitting HTTP requests. These options will be passed as-is to Fetch, so consumers should reference the Fetch API documentation to determine which values are applicable.<br><br>In addition, this library uses [@adobe/cloud-service-client](https://github.com/adobe/cloud-service-client), so passing a `cloudClient` property as described in that library's documentation is also supported. |
| `withConcurrent(<boolean>)` | N | Default: `false`. If `true`, multiple files in the supplied list of upload files will transfer simultaneously. If `false`, only one file will transfer at a time, and the next file will not begin transferring until the current file finishes. |
| `withMaxConcurrent(<number>)` | N | Default: `5`. The maximum number of concurrent HTTP requests that are allowed at any one time. As explained in the `withConcurrent()` option, the library will concurrently upload multiple files at once. This value essentially indicates the maximum number of files that the process will upload at once. <br><br>A value less than 2 will instruct the library _not_ to upload more than one file concurrently.|
| `withHttpRetryCount()` | N | Default: `3`. The number of times that the process will retry a failed HTTP request before giving up. For example, if the retry count is 3 then the process will submit the same HTTP request up to 3 times if the response indicates a failure. |
| `withHttpRetryDelay()` | N | Default: `5`. The amount of time that the process will wait before retrying a failed HTTP request. The value is specified in milliseconds. With each increasing retry, the delay will increase by its value. For example, if the delay is 5000 then the first retry will wait 5 seconds, the second 10 seconds, the third 15 seconds, etc. |

#### Upload File Options

| Property | Required | Type | Description |
| ------ | -------- | ---- | ----------- |
| `fileName` | Y | string | The name of the file as it will appear in AEM. This value _does not_ need to be URI encoded. |
| `fileSize` | Y | number | Total size, in bytes, of the file to upload. |
| `filePath` | N | string | Full path to a local file to upload. Note that either this value _or_ `blob` must be specified. This option is typically most useful when running the upload tool from a Node.js process. |
| `blob` | N | File | Data for a file. The only tested and supported value for this property is the `value` of an HTML `<input type='file' />`. Note that either this property _or_ `filePath` must be specified. This option is typically most useful when running the upload tool from a browser. |
| `partHeaders` | N | object | Header values to be included with each part of this file that is transferred. The headers from `DirectBinaryUploadOptions` are only included in requests that are sent to AEM; they are ignored when sending requests to the direct binary upload URIs provided by AEM. This option provides a means for specifying any additional headers that should be included in requests sent to these URIs. |
| `createVersion` | N | boolean | Default: `false`. If `true` and an asset with the given name already exists, the process will create a new version of the asset instead of updating the current version with the new binary. |
| `versionLabel` | N | string | Default: `null`. If the process creates a new version of the asset, the label to associated with the newly created version. |
| `versionComment` | N | string | Default: `null`. If the process creates a new version of the asset, the comment to associated with the newly created version. |
| `replace` | N | boolean | Default: `false`. If `true` and an asset with the given name already exists, the process will delete the existing asset and create a new one with the same name and the new binary.<br/><br/>Note that if both this option and `createVersion` are specified, `createVersion` will take priority. |

### Error Handling

If a file fails to upload, the process will move to the next file in the list. The overall process
itself will only fail if something catastrophic happens that prevents it from continuing to
upload files. It's left up to the consumer to determine if there were individual file upload
failures and react to them accordingly.

All errors reported by the upload process will be instances of `UploadError`, which are
standard javascript `Error` instances with an additional `code` value that indicates
the type of error. Specific codes are available in `DirectBinary.DirectBinaryUploadErrorCodes`.

The following is an example of handling errors, at either the process or file level.

```javascript
const codes = DirectBinary.DirectBinaryUploadErrorCodes;
const upload = new DirectBinary.DirectBinaryUpload();
upload.uploadFiles(options) // assume that options is defined previously
    .then(result => {
        // use this method to retrieve ALL errors during the process
        const { errors = [] } = result;
        errors.forEach(error => {
            if (error.code === codes.ALREADY_EXISTS) {
                // handle case where a file already exists
            }
        });
        const { detailedResult = [] } = result;
        // or retrieve individual file errors
        detailedResult.forEach((fileResult) => {
            const { result = {} } = fileResult;
            const { errors = [] } = result;
            errors.forEach((fileErr) => {
                // content of fileErr may vary
            });
        });
    })
    .catch(err => {
        if (err.code === codes.NOT_SUPPORTED) {
            // handle case where direct binary access is not enabled
            // on the target instance
        }
    });
```

Another way of handling individual file errors is to listen for the upload process's
[Events](#upload-events).

The process implements automatic HTTP retry handling, meaning that if an HTTP request fails
then the process will wait for a specified interval and retry the same HTTP request a given
number of times. If the request still fails after the given number of retries, it will
report the error as normal using the last error. Any errors that caused a retry, in
either a success scenario or failure scenario, will be reported in the result in a dedicated
structure.

### Upload Events

As the upload process moves through individual files, it will send events as it goes
through the stages of uploading a file. These events are listed below.

| Event | Description | Data |
| ----- | ----------- | ---- |
| `fileuploadstart` | Indicates an upload of one or more files is starting. | [Upload Session Data](#upload-session-data) |
| `fileuploadend` | Indicates an upload of one or more files has finished. | Simple javascript object containing the same upload result information that is returned by the library's `upload()` method. |
| `filestart` | Indicates that a file has started to upload. | [File Event Data](#file-event-data) |
| `fileprogress` | Indicates that a file has started to upload. | [File Progress Event Data](#file-progress-event-data) |
| `fileend` | Indicates that a file has uploaded successfully. This event will _not_ be sent if the file upload did not finish successfully for any reason. | [File Event Data](#file-event-data) |
| `fileerror` | Sent if a file fails to upload due to an error. This event will not be sent if the file uploads successfully. | [File Error Event Data](#file-error-event-data) |
| `foldercreated` | Indicates that the upload process created a new folder in the target. | [Folder Event Data](#folder-event-data) |

#### Upload Session Data

| Property | Type | Description |
| -------- | ---- | ----------- |
| `uploadId` | string | A unique identifier that can be used to identify the upload session. |
| `fileCount` | number | The total number of files that will be uploaded as part of this upload session. |
| `totalSize` | number | The total size, in bytes, of all files that will be uploaded as part of this upload session. |
| `directoryCount` | number | The number of directories included in the upload session. |

#### Folder Event Data

| Property | Type | Description |
| -------- | ---- | ----------- |
| `folderName` | string | The name (i.e. title) of the folder, as it was created. This will _not_ be a URI encoded value. |
| `targetParent` | string | Full path to the AEM folder where the folder was created. This will _not_ be a URI encoded value. |
| `targetFolder` | string | Full path to the AEM folder that was created. This will _not_ be a URI encoded value. |

#### File Event Data

| Property | Type | Description |
| -------- | ---- | ----------- |
| `fileName` | string | The name of the file, as it was specified in the upload options. This will _not_ be a URI encoded value. |
| `fileSize` | number | The size of the file, in bytes, as it was specified in the upload options. |
| `targetFolder` | string | Full path to the AEM folder where the file is being uploaded. This will <i>not</i> be a URI encoded value. |
| `targetFile` | string | Full path to the asset in AEM. This will _not_ be a URI encoded value. |
| `mimeType` | string | HTTP _Content-Type_ value of the file. |

#### File Progress Event Data

This event data includes all properties from [File Event Data](#file-event-data), with the addition of:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `transferred` | number | The number of the file's bytes that have been uploaded so far. This will be a cumulative value, increasing each time the event is sent. |

#### File Error Event Data

This event data includes all properties from [File Event Data](#file-event-data), with the addition of:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `errors` | [Error Event Data[]](#error-event-data) | An array of [Error Event Data](#error-event-data) describing the error(s) that occurred during upload. |

#### Error Event Data

| Property | Type | Description |
| -------- | ---- | ----------- |
| `code` | string | Indicates the general type of error. See the app's [constants](src/constants.js) for possible values. |
| `message` | string | More descriptive information about the error. |
| `innerStack` | string | When present, the code stack that lead to the error. |

The following is an example of how to handle various events.

```javascript
const upload = new DirectBinary.DirectBinaryUpload();
upload.on('filestart', data => {
    const { fileName } = data;

    // specific handling that should occur when a file begins uploading
});
upload.on('fileprogress', data => {
    const { fileName, transferred } = data;

    // specific handling that should occur as a file uploads
});
upload.on('fileend', data => {
    const { fileName } = data;

    // specific handling that should occur when a file finishes uploading successfully
});
upload.on('fileerror', data => {
    const { fileName, errors } = data;

    // specific handling that should occur when a file files to upload
});

// assume options has been declared previously
upload.uploadFiles(options);
```

## Uploading Local Files

The library supports uploading local files and folders. For folders, the tool
will include all immediate children files in the folder. It will not process sub-folders unless the "deep upload" option is specified.

When deep uploading, the library will create a folder structure in the target that mirrors the folder being uploaded. The title of the newly
created folders will match the name of the folder as it exists on the local filesystem. The path of the target may be modified depending on
path character restrictions in AEM, and depending on the options provided in the upload (see "Function for processing folder node names" for
more information).

Whenever the library creates a new folder, it will emit the `foldercreated` event. See event documentation for details.

The following example illustrates how to upload local files.

```javascript
const {
    FileSystemUploadOptions,
    FileSystemUpload
} = require('@adobe/aem-upload');

// configure options to use basic authentication
const credentials = Buffer.from('admin:admin').toString('base64')
const options = new FileSystemUploadOptions()
    .withUrl('http://localhost:4502/content/dam/target-folder')
    .withHttpOptions({
        headers: {
            Authorization: `Basic ${credentials}`
        }
    });

// upload a single asset and all assets in a given folder
const fileUpload = new FileSystemUpload();
await fileUpload.upload(options, [
    '/Users/me/myasset.jpg',
    '/Users/me/myfolder'
]);
```

### Supported File Options

There is a set of options, `FileSystemUploadOptions`, that are specific to uploading local files. In addition to [default options](#supported-options), the following options are available.

| Option | Required | Description |
| ------ | ---- | ----------- |
| `withMaxUploadFiles(<number>)` | N | Default: 1000. The maximum number of files that the library will attempt to upload. If the target upload exceeds this number then the process will fail with an exception. |
| `withDeepUpload(<boolean>)` | N | Default: false. If true, the process will include all descendent folders and files when given a folder to upload. If false, the process will only upload those files immediately inside the folder to upload. |
| `withFolderNodeNameProcessor(<function<Promise>>)` | N | When performing a deep upload, the tool will create folders in AEM that match local folders being uploaded. The tool will "clean" the folder names of certain characters when creating node names for each folder. The unmodified folder name will become the node's title.<br/><br/>This option allows customization of the functionality that cleans the folder's name. The option should be a <code>function</code>. It will receive a single argument value: the name of the folder to be cleaned. The return value of the function should be a <code>Promise</code>, which should resolve with the clean folder name.<br/><br/>The default functionality will convert the folder name to lower case and replace whitespace and any of the characters <code>%;#,+?^{}</code> with the replacement value specified in the options.<br/><br/>Regardless of this function, the library will <i>always</i> replace any of the characters <code>./:[]|*\</code> with the replacement value specified in the options. |
| `withAssetNodeNameProcessor(<function<Promise>>)` | N | When performing a deep upload, the tool will create assets in AEM that match local files being uploaded. The tool will "clean" the file names of certain characters when creating node names for each asset.<br/><br/>This option allows customization of the functionality that cleans the file's name. The option should be a <code>function</code>. It will receive a single argument value: the name of the  file to be cleaned. The return value of the function should be a <code>Promise</code>, which should resolve with the clean asset name.<br/><br/>The default functionality will replace any of the characters <code>#%{}?&</code> with the replacement value specified in the options.<br/><br/>Regardless of this function, the library will <i>always</i> replace any of the characters<code>./:[]|*\</code> with the replacement value specified in the options. |
| `withInvalidCharacterReplaceValue(<string>)` | N | Default: `-`. Specifies the value to use when replacing invalid characters in folder and asset node names. This value is used in the default functions that clean folder/asset names, and is <i>always</i> used when replacing any of the characters <code>./:[]|*\</code>; the value of this option <i>cannot</i> contain any of those characters.<br/><br/>For example, assume the folder name <code>My Test Folder #2</code>. With the default settings, the folder's node would be <code>my-test-folder--2</code>. |
| `withUploadFileOptions(<UploadFileOptions>)` | N | Specifies the options to use when uploading each file as part of the file system upload. Most of the [Upload File Options](#upload-file-options) are valid. The exceptions are `fileName`, `fileSize`, `filePath`, and `blob`, which will be ignored. |

## Logging

The library will log various messages as it goes through the process of uploading items. It will use whichever logger it's given, as long as the object supports methods `debug()`, `info()`, `warn()`, and `error()`. For maximum detail, the library also assumes that each of these methods can accept formatted messages: `log.info('message with %s', 'formatting');`. The logging will work regardless of formatting support, but there will be more information when formatting works correctly.

To provide a logger to the library, pass a `log` element in the options sent into the `DirectBinaryUpload` constructor. Here is a simple example that will log all the library's messages to `console`:

```
const upload = new DirectBinary.DirectBinaryUpload({
  log: {
    debug: (...theArguments) => console.log.apply(null, theArguments),
    info: (...theArguments) => console.log.apply(null, theArguments),
    warn: (...theArguments) => console.log.apply(null, theArguments),
    error: (...theArguments) => console.log.apply(null, theArguments),
  }
});
```

Note that this will also work with the `FileSystemUpload` constructor.

## Proxy Support

The library utilizes the Fetch API, so when running in a browser, proxy settings are detected and applied by the browser. In Node.JS, all HTTP requests are sent directly to the target, without going through a proxy. Auto detecting a system's proxy settings is not supported in Node.JS, but
consumers can use `DirectBinaryUploadOptions.withHttpOptions()` to provde an `agent` value as recommended by `node-fetch`.

# Features
* Well tuning to take advantage of nodejs for best uploading performance
* Track transfer progress of files
* Cancel in-progress transfers
* Transfer multiple files "in batch"
* Upload local folder/file structures

# Releasing

This module uses [semantic-release](https://github.com/semantic-release/semantic-release) when publishing new versions. The process is initiated upon merging commits to the `master` branch. Review semantic-release's documentation for commit message format.

PRs whose messages do not meet semantic-release's format will _not_ generate a new release.

Release notes are generated based on git commit messages. Release notes will appear in `CHANGELOG.md`.

# Contributing

Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.

# Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.

# Maintainers
* [@Jun Zhang](https://github.com/FrancoisZhang)
* [@Mark Frisbey](https://github.com/mfrisbey)
