export default class TimeoutError extends Error {
    constructor(message?: string) {
        super(message);

        this.name = this.constructor.name;

        if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}
