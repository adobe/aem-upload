- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)

# Install
This project uses [node](http://nodejs.org) and [npm](https://npmjs.com). Go check them out if you don't have them locally installed.

```sh
# make sure login assets-skyline registry first for Adobe internal artifactory, use ldap as credential
$ npm login --scope=@assets-skyline --registry=https://artifactory.corp.adobe.com/artifactory/api/npm/npm-assets-skyline-release-local/

# for OSX, sudo is required for global npm install
$ sudo npm install -g @assets-skyline/skyline-upload
```

# Usage
```sh
$ skyline-upload files
```

# Maintainers
[@Jun Zhang](https://git.corp.adobe.com/zjun).
