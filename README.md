- [Background](#background)
- [Command Line](#command-line)
- [Usage](#usage)
  - [Install](#install)
  - [Requiring the Module](#requiring-the-module)
  - [Uploading Files](#uploading-files)
    - [Supported Options](#supported-options)
    - [Error Handling](#error-handling)
    - [Upload Events](#upload-events)
    - [Controlling In-Progress Uploads](#controlling-in-progress-uploads)
  - [Uploading Local Files](#uploading-local-files)
- [Features](#features)
- [Releasing](#releasing)
- [Todo](#todo)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [Maintainers](#maintainers)

# Background

In legacy AEM Assets, a single post request to createAsset servlet is enough for uploading files. Skyline uses direct binary access, which requires
a more involved algorithm.

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

Following is the mimimum amount of code required to upload files to a target AEM instance.

```javascript
const DirectBinary = require('@adobe/aem-upload');

// URL to the directory in AEM where assets will be uploaded. Directory
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

The `DirectBinaryUploadOptions` class supports the following options. Items with * are required.

<table>
    <thead>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody style="vertical-align: top">
        <tr>
            <td>* URL</td>
            <td>string</td>
            <td>
                Full, absolute URL to the Directory in the target instance where the specified files will be uploaded.
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>
                options.withUrl('http://localhost:4502/content/dam/target');
                </code>
            </td>
        </tr>
        <tr>
            <td>* Upload Files</td>
            <td>Array</td>
            <td>
                List of files that will be uploaded to the target URL. Each item in the array should be
                an <code>object</code> consisting of the following properties:
                <table>
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody style="vertical-align: top">
                        <tr>
                            <td><b>fileName<b></td>
                            <td>string</td>
                            <td>
                                The name of the file as it will appear in AEM.
                            </td>
                        </tr>
                        <tr>
                            <td><b>fileSize</b></td>
                            <td>number</td>
                            <td>
                                Total size, in bytes, of the file to upload.
                            </td>
                        </tr>
                        <tr>
                            <td>filePath</td>
                            <td>string</td>
                            <td>
                                Full path to a local file to upload. Note that either this value
                                <i>or</i> <code>blob</code> must be specified. This option is
                                typically most useful when running the upload tool from a Node.js
                                process.
                            </td>
                        </tr>
                        <tr>
                            <td>blob</td>
                            <td>Array</td>
                            <td>
                                Array containing all the bytes that make up the file. Note that either
                                this value <i>or</i> <code>filePath</code> must be specified. This
                                option is typically most useful when running the upload tool from a
                                browser.
                            </td>
                        </tr>
                        <tr>
                            <td>createVersion</td>
                            <td>boolean</td>
                            <td>
                                If <code>true</code> and an asset with the given name already exists,
                                the process will create a new version of the asset instead of updating the
                                current version with the new binary.
                                <br/>
                                <br/>
                                Default: <code>false</code>
                            </td>
                        </tr>
                        <tr>
                            <td>versionLabel</td>
                            <td>string</td>
                            <td>
                                If the process creates a new version of the asset, the label to
                                associated with the newly created version.
                                <br/>
                                <br/>
                                Default: <code>null</code>
                            </td>
                        </tr>
                        <tr>
                            <td>versionComment</td>
                            <td>string</td>
                            <td>
                                If the process creates a new version of the asset, the comment to
                                associated with the newly created version.
                                <br/>
                                <br/>
                                Default: <code>null</code>
                            </td>
                        </tr>
                        <tr>
                            <td>replace</td>
                            <td>boolean</td>
                            <td>
                                If <code>true</code> and an asset with the given name already exists,
                                the process will delete the existing asset and create a new one with the same
                                name and the new binary.
                                <br/>
                                <br/>
                                Note that if both this option and "create version" are specified, "create version"
                                will take priority.
                                <br/>
                                <br/>
                                Default: <code>false</code>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <pre>
options.withUploadFiles([
    {
        fileName: 'file1.jpg',
        fileSize: 1024,
        filePath: '/Users/me/Documents/file1.jpg'
    },
    {
        fileName: 'file2.jpg',
        fileSize: 2048,
        blob: [
            'h', 'e', 'l', 'l', 'o'
        ]
    }
]);</pre>
            </td>
        </tr>
        <tr>
            <td>headers</td>
            <td>object</td>
            <td>
                HTTP headers that will be included in each request sent to AEM. Each property should
                be a header name, with the value being the header's value.
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withHeaders({</code>
                <br/>
                <code>&nbsp;&nbsp;&nbsp;&nbsp;'content-type': 'image/jpeg',</code>
                <br/>
                <code>&nbsp;&nbsp;&nbsp;&nbsp;'authorization': '12345'</code>
                <br/>
                <code>});</code>
            </td>
        </tr>
        <tr>
            <td>concurrent</td>
            <td>boolean</td>
            <td>
                If <code>true</code>, multiple files in the supplied list of upload files will
                transfer simultaneously. If <code>false</code>, only one file will transfer at
                a time, and the next file will not begin transferring until the current file
                finishes.
                <br/>
                <br/>
                Default: <code>false</code>.
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withConcurrent(true);</code>
            </td>
        </tr>
        <tr>
            <td>max concurrent requests</td>
            <td>number</td>
            <td>
                The maximum number of concurrent HTTP requests that are allowed at any one time. As explained in the
                <i>concurrent</i> option, the library will concurrently upload multiple files at once. This value
                essentially indicates the maximum number of files that the process will upload at once.
                <br/>
                <br/>
                A value less than 2 will instruct the library <i>not</i> to upload more than one file concurrently.
                <br/>
                <br/>
                Default: <code>5</code>.
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withMaxConcurrent(2);</code>
            </td>
        </tr>
        <tr>
            <td>add content length header</td>
            <td>boolean</td>
            <td>
                If <code>true</code>, the upload process will automatically add a
                <code>Content-Length</code> header when uploading file parts to AEM. If
                <code>false</code>, no such header will be added.
                <br/>
                This option is relevant depending on the context in which the process is running.
                For example, if running through Node.js then the underlying libraries will not
                automatically add a <code>Content-Length</code> header when submitting an HTTP
                <code>PUT</code> request, so it must be explicitly added. However, when running
                through a browser the underlying libraries <i>will</i> automatically
                add a <code>Content-Length</code> header, and will issue a warning if it's
                explicitly added.
                <br/>
                <br/>
                Default: <code>false</code>
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withAddContentLengthHeader(true);</code>
            </td>
        </tr>
        <tr>
            <td>http retry count</td>
            <td>number</td>
            <td>
                The number of times that the process will retry a failed HTTP request before
                giving up. For example, if the retry count is 3 then the process will submit
                the same HTTP request up to 3 times if the response indicates a failure.
                <br/>
                <br/>
                Default: <code>3</code>
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withHttpRetryCount(5);</code>
            </td>
        </tr>
        <tr>
            <td>http retry delay</td>
            <td>number</td>
            <td>
                The amount of time that the process will wait before retrying a failed HTTP
                request. The value is specified in milliseconds. With each increasing retry,
                the delay will increase by its value. For example, if the delay is 5000 then
                the first retry will wait 5 seconds, the second 10 seconds, the third 15
                seconds, etc.
                <br/>
                <br/>
                Default: <code>5000</code>
                <br/>
                <br/>
                <b>Example</b>
                <br/>
                <code>options.withHttpRetryDelay(3000);</code>
            </td>
        </tr>
    </tbody>
</table>

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
        result.getErrors().forEach(error => {
            if (error.getCode() === codes.ALREADY_EXISTS) {
                // handle case where a file already exists
            }
        });

        // or retrieve individual file errors
        result.getFileUploadResults().forEach(fileResult => {
            fileResult.getErrors().forEach(fileErr => {
                if (fileErr.getCode() === codes.ALREADY_EXISTS) {
                    // "fileResult" contains information about the file
                    const fileName = fileResult.getFileName();

                    // handle case where file already exists
                }
            });
        });
    })
    .catch(err => {
        if (err.getCode() === codes.NOT_SUPPORTED) {
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

<table>
    <thead>
        <tr>
            <th>Event</th>
            <th>Description</th>
            <th>Data</th>
        </tr>
    </thead>
    <tbody style="vertical-align: top">
        <tr>
            <td>filestart</td>
            <td>Indicates that a file has started to upload.</td>
            <td>
                The data sent with the event will be a simple javascript <code>object</code>
                with the following properties:
                <table>
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody style="vertical-align: top">
                        <tr>
                            <td>fileName</td>
                            <td>string</td>
                            <td>
                                The name of the file, as it was specified in the upload options.
                            </td>
                        </tr>
                        <tr>
                            <td>fileSize</td>
                            <td>number</td>
                            <td>
                                The size of the file, in bytes, as it was specified in the upload
                                options.
                            </td>
                        </tr>
                        <tr>
                            <td>targetFolder</td>
                            <td>string</td>
                            <td>
                                Full path to the AEM folder where the file is being uploaded.
                            </td>
                        </tr>
                        <tr>
                            <td>targetFile</td>
                            <td>string</td>
                            <td>Full path to the asset in AEM.</td>
                        </tr>
                        <tr>
                            <td>mimeType</td>
                            <td>string</td>
                            <td>HTTP <code>Content-Type</code> value of the file.</td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
        <tr>
            <td>fileprogress</td>
            <td>
                Sent periodically and includes information about how much of the file has uploaded.
            </td>
            <td>
                A simple javascript <code>object</code> containing the same properties as "filestart,"
                in addition to the following properties:
                <table>
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody style="vertical-align: top">
                        <tr>
                            <td>transferred</td>
                            <td>number</td>
                            <td>The number of the file's bytes that have been uploaded so far.</td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
        <tr>
            <td>fileend</td>
            <td>
                Indicates that a file has uploaded successfully. This event will <i>not</i> be sent if
                the file failed to upload, or if the file upload was cancelled.
            </td>
            <td>
                A simple javascript <code>object</code> containing the same properties as "filestart."
            </td>
        </tr>
        <tr>
            <td>fileerror</td>
            <td>
                Sent if a file fails to upload. This event will <i>not</i> be sent if the file uploads
                successfully, or if the file upload was cancelled.
            </td>
            <td>
                A simple javascript <code>object</code> containing the same properties as "filestart,"
                in addition to the following properties:
                <table>
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody style="vertical-align: top">
                        <tr>
                            <td>errors</td>
                            <td>Array</td>
                            <td>
                                A list of all the errors that occurred while trying to upload
                                the file. Each item in the array will be an instance of type
                                <code>UploadError</code>. See "Error Handling" for more details.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
        <tr>
            <td>filecancelled</td>
            <td>
                Indicates that a file upload was cancelled.
            </td>
            <td>
                A simple javascript <code>object</code> containing the same properties as "filestart."
            </td>
        </tr>
    </tbody>
</table>

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

### Controlling In-Progress Uploads

After the process of uploading one or more files begins, it's possible to interact
with the process using a controller. The controller allows operations like cancelling
individual file uploads or _all_ uploads.

The following is an example for how to control the process.

```javascript
const options = new DirectBinaryUploadOptions()
    .withUrl(url)
    .withUploadFiles(files);

// retrieve a controller instance from the options
const controller = options.getController();
const upload = new DirectBinaryUpload();
upload.uploadFiles(options);

// at this point its possible to send command to the upload process using
// the controller

// cancel the upload of an individual file
controller.cancelFile(fileName);

// cancel ALL files in the upload
controller.cancel();
```

## Uploading Local Files

The library supports uploading local files and directories. For directories, the tool
will include all immediate child files in the directory. It will not process sub-directories.

The following example illustrates how to upload local files.

```javascript
const {
    DirectBinaryUploadOptions,
    FileSystemUpload
} = require('@adobe/aem-upload');

// configure options to use basic authentication
const options = new DirectBinaryUploadOptions()
    .withUrl('http://localhost:4502/content/dam/target-folder')
    .withBasicAuth('admin:admin')
    .withAddContentLengthHeader(true);

// upload a single asset and all assets in a given directory
const fileUpload = new FileSystemUpload();
await fileUpload.upload(options, [
    '/Users/me/myasset.jpg',
    '/Users/me/mydirectory'
]);
```

# Features
* Well tunning for take advantage of nodejs for best uploading performance
* Track transfer progress of files
* Cancel in-progress transfers
* Transfer multiple files "in batch"

# Releasing

To publish a new version of the tool, use the following steps:

1. Ensure you have publish permissions and have run `npm login` using your NPM credentials. From the root directory, run `npm publish`.
1. Edit `package.json` and increment the version number.
1. Commit changes to `package.json`.

# Todo
* Recursive asset uploading for sub folders
* Pause/resume uploads
* Use a "thread pool" to limit the number of concurrent operations
* Automatically retry failed requests

# Contributing

Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.

# Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.

# Maintainers
* [@Jun Zhang](https://github.com/FrancoisZhang)
* [@Mark Frisbey](https://github.com/mfrisbey)
