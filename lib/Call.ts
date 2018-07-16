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
    public timer: NodeJS.Timer;

    constructor(options: CallOptions, private success: (res: any) => void, private failure: (err: Error) => void) {
        this.id = Call.callCount++;
        this.retries = 0;
        Object.assign(this, options);
    }

    public resolve(res: any): void {
        if (!this.resolved && !this.rejected) {
            this.resolved = true;
            clearTimeout(this.timer);
            this.success(res);
        }
    }

    public reject(err: Error): void {
        if (!this.resolved && !this.rejected) {
            this.rejected = true;
            clearTimeout(this.timer);
            this.failure(err);
        }
    }

    public launchTimeout(): void {
        if (this.timeout === Infinity) {
            return;
        }

        this.timer = setTimeout(async () => {
            this.reject(new TimeoutError(`Call ${this.id} timed out.`));
        }, this.timeout);
    }

    public retry(): void {
        this.retries++;
        this.resolved = false;
        this.rejected = false;
    }
}
