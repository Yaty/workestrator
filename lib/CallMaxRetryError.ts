export default class CallMaxRetryError extends Error {
    constructor(public err: Error, message: string = "Call max retried.") {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
