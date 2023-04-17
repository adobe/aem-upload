# Upgrade Guide

This document will provide instructions for upgrading between breaking versions of the library. We hope to keep breaking changes to a minimum, but they will happen. Please feel free to submit an issue if we've missed anything.

## Upgrading to 2.x.x

Here are a few things to know when upgrading to version 2 of the library.

### Upload Result

The structure of the upload results provided by the library has changed. Previously, the result was a class instance containing various metrics about the upload process. In version 2, the class was changed to a simple javascript `object`.

The item in question is illustrated with the following code:

```
const result = await upload.uploadFiles(options);
```

The contents of `result` has changed in version 2. Previously, there would have been methods like:

```
result.getTotalFiles();
result.getElapesedTime();
result.getTotalSize();
```

After version 2, the contents of `result` will be a simple object:

```
{
    ...
    totalFiles: 2,
    totalTime: 2367,
    totalSize: 127385
    ...
}
```

(Note that this is only a sampling of the result data; the actual contents will be more extensive).

In addition, the result will contain less detail than it did prior to version 2. For example, information about individual file parts, time spent initializing the upload, and some other file upload related metrics are no longer available.

### Exported Code

The library originally exported a transpiled version of its code; this was intended to increase the number of Node.JS versions and browser versions that the library could support. Version 2 has been updated so that the library's primary exports will consist of the code as-is. This means that older versions of Node.JS will no longer be supported through the primary exports. The transpiled code is still available in the `dist` directory, which is also set as the library's `browser` target.

In addition, the library no longer uses module-like syntax. This slightly changes the way that non-modules will need to consume the library's exports.

For modules, the `import` statement will continue to work; no changes required:

```
// this will still work
import AemUpload from '@adobe/aem-upload';
```

For non-modules, there will need to be changes if using the `default` export:

```
// this will no longer work:
const AemUpload = require('@adobe/aem-upload').default;
```

Instead, remove `default`:

```
// this will work:
const AemUpload = require('@adobe/aem-upload');
```
