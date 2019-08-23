export default class UploadBase {
    constructor(options = {}) {
        this.options = options;
        this.log = options.log;
    }

    logInfo(...theArguments) {
        if (this.log) {
            this.log.info.apply(this.log, theArguments);
        }
    }

    logWarn(...theArguments) {
        if (this.log) {
            this.log.warn.apply(this.log, theArguments);
        }
    }

    logDebug(...theArguments) {
        if (this.log) {
            this.log.debug.apply(this.log, theArguments);
        }
    }

    logError(...theArguments) {
        if (this.log) {
            this.log.error.apply(this.log, theArguments);
        }
    }
}