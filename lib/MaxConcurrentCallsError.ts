export default class MaxConcurrentCallsError extends Error {
    constructor(message: string = "Max concurrent calls limit reached.") {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
