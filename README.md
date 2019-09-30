- [Background](#background)
- [Command Line](#command-line)
  - [Install](#install)
    - [Using NPM](#using-npm)
    - [Using Source](#using-source)
  - [Usage](#usage)
- [Node.js Module](#nodejs-module)
  - [Requiring the Module](#requiring-the-module)
  - [Uploading Files](#uploading-files)
    - [Supported Options](#supported-options)
    - [Error Handling](#error-handling)
    - [Upload Events](#upload-events)
    - [Controlling In-Progress Uploads](#controlling-in-progress-uploads)
- [Features](#features)
- [Releasing](#releasing)
- [Todo](#todo)
- [Maintainers](#maintainers)

# Background

In legacy AEM Assets, a single post request to createAsset servlet is enough for uploading files. Skyline uses direct binary access, which requires
a more involved algorithm.

This tool is provided for making uploading easier, and can be used as a command line executable
or required as a Node.js module.

![](doc/aem-fastingest-nui-architecture-overview.png)

# Command Line

This section describes how to use the tool from the command line to upload assets from a specific local directory to a target folder in an AEM instance..

## Install
This project uses [node](http://nodejs.org) and [npm](https://npmjs.com). Go check them out if you don't have them locally installed.

### Using NPM
```sh
# this option will use the version of the library that is published to NPM
$ sudo npm install -g @assets-skyline/skyline-upload
```

### Using Source
```sh
# 1. Download the source code either by cloning the repository or downloading it as a zip file

# 2. Enter the root folder and do these commands
$ npm install
$ npm run build
$ sudo npm install -g .
```

## Usage
```sh
$ skyline-upload --help
Usage: skyline-upload [options] files&folder...

Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  -h, --host        Skyline host                [string] [default: "http://localhost:4502"]
  -c, --credential  Skyline credential          [string] [default: "admin:admin"]
  -t, --target      Skyline target folder       [string] [default: "/content/dam/skyline-upload-1566281417039"]
  -l, --log         Log file path               [string] [default: "upload-1566281417039.log"]
  -o, --output      Result html file path       [string] [default: "result-1566281417039.html"]
```

# Node.js Module

Follow these directions to consume the tool as a Node.js library. When used as a library the tool
supports uploading files to a target instance, while providing support for monitoring the progress
of file transfers.

## Requiring the Module

To add the module to your Node.js project:

1. Install the module in your project using one of the [installation options](#install).
1. Require the module in the javascript file where it will be consumed:

```javascript
const DirectBinary = require('@assets-skyline/skyline-upload');
```

## Uploading Files

Following is the mimimum amount of code required to upload files to a target AEM instance.

```javascript
const DirectBinary = require('@assets-skyline/skyline-upload');

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
            <td>Add content length header</td>
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

# Features
* Well tunning for take advantage of nodejs for best uploading performance
* Well formated json and html format performance result as below:
![](doc/test-result-html.png)

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

# Maintainers
* @Jun Zhang
* [@Mark Frisbey](https://github.com/mfrisbey)
