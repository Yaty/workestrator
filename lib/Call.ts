import TimeoutError from "./TimeoutError";
import {CallOptions} from "./types";

export default class Call {
    private static callCount: number = 0;

    public id: number;
    public retries: number;
    public args: any[];
    public method?: string;
    public timeout: number;
    public resolved: boolean = false;
    public rejected: boolean = false;
    public workerId: number;

    constructor(options: CallOptions, private success: (res: any) => void, private failure: (err: Error) => void) {
        this.id = Call.callCount++;
        this.retries = 0;
        Object.assign(this, options);
    }

    public resolve(res: any) {
        if (!this.resolved && !this.rejected) {
            this.resolved = true;
            this.success(res);
        }
    }

    public reject(err: Error) {
        if (!this.resolved && !this.rejected) {
            this.rejected = true;
            this.failure(err);
        }
    }

    public launchTimeout() {
        if (this.timeout === Infinity) {
            return;
        }

        setTimeout(async () => {
            if (!this.resolved && !this.rejected) {
                this.reject(new TimeoutError(`Call ${this.id} timeout.`));
            }
        }, this.timeout);
    }

    public retry() {
        this.retries++;
        this.resolved = false;
        this.rejected = false;
    }
}
