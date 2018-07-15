export default class WorkerTerminatedError extends Error {
    constructor(message: string = "The worker in charge of this call was killed. Retrying according to the policy.") {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
