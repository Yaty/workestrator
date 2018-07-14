export default class CallMaxRetryError extends Error {
    constructor(public err: Error, message: string = "Call max retried.") {
        super(message);

        this.name = this.constructor.name;

        if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}
