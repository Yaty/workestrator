import logger, {IDebugger} from "debug";
import {EventEmitter} from "events";
import Call from "./Call";
import CallMaxRetryError from "./CallMaxRetryError";

import {
    CallOptions,
    InternalFarmOptions,
    WorkerToMasterMessage,
} from "./types";

import TimeoutError from "./TimeoutError";
import * as utils from "./utils";
import Worker from "./worker/Worker";

export default class Farm extends EventEmitter {
    private static farmCount: number = 0;

    public readonly id: number;
    public workers: Worker[];
    private readonly debug: IDebugger;
    private queue: Call[];
    private pendingCalls: Call[];
    private running: boolean = true;

    constructor(private options: InternalFarmOptions) {
        super();
        this.id = Farm.farmCount++;
        this.debug = logger("workhorse:farm:" + this.id);
        this.init();
    }

    public run(...args: any[]) {
        return this.dispatch({
            args,
            timeout: this.options.timeout,
        });
    }

    public runMethod(method: string, ...args: any[]) {
        return this.dispatch({
            args,
            method,
            timeout: this.options.timeout,
        });
    }

    public async kill(): Promise<void> {
        this.running = false;
        await Promise.all(this.workers.map((w) => w.kill()));
        utils.removeElements(this.workers, this.queue, this.pendingCalls);
        this.debug("Farm killed.");
    }

    private removeCallFromPending(callId: number): Call | undefined {
        const callIndex = this.pendingCalls.findIndex((c: Call) => c.id === callId);

        if (callIndex === -1) {
            return;
        }

        const call = this.pendingCalls[callIndex];
        this.pendingCalls.splice(callIndex, 1);
        return call;
    }

    private async receive(data: WorkerToMasterMessage): Promise<void> {
        const call = this.removeCallFromPending(data.callId);

        if (!call) {
            this.debug("Call not found");
            return;
        }

        if (data.err) {
            this.debug("Receive error : %o", data.err);

            let error;

            switch (data.err.name) {
                case "TypeError": error = new TypeError(); break;
                case "RangeError": error = new RangeError(); break;
                case "EvalError": error = new EvalError(); break;
                case "ReferenceError": error = new ReferenceError(); break;
                case "SyntaxError": error = new SyntaxError(); break;
                case "URIError": error = new URIError(); break;
                default: error = new Error();
            }

            call.reject(Object.assign(error, data.err));
        } else {
            this.debug("Receive data : %o", data);
            call.resolve(data.res);
        }
    }

    private dispatch(options: CallOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            this.debug("Dispatch %o", options);

            const call = new Call(options, resolve, async (err: Error) => {
                // If a timeout occur then the worker is certainly in a blocking state
                // So we have to kill it (a new worker will be created automatically)
                if (err instanceof TimeoutError) {
                    const worker = this.getWorkerById(call.workerId);

                    if (worker) {
                        this.debug("Call %d on worker %d has timed out. Killing the worker.", call.id, call.workerId);
                        await worker.kill();
                    }

                    return reject(err);
                }

                // When a call have been retried too much
                if (call.retries >= this.options.maxRetries) {
                    this.debug("Max retry limit reached on call %d.", call.id);
                    return reject(new CallMaxRetryError(err));
                }

                // Retry a call until it succeed or until the retry limit
                this.debug("Retrying the call %d (%d / %d).", call.id, call.retries + 1, this.options.maxRetries);
                this.removeCallFromPending(call.id);
                call.retry();
                this.queue.push(call);
                this.processQueue();
            });

            this.queue.push(call);
            this.processQueue();
        });
    }

    private restartWorker(id: number): void {
        for (let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];

            if (worker.id === id) {
                this.debug("Worker %d removed.", id);
                this.workers.splice(i, 1);

                if (this.running) {
                    this.startWorkers();
                }

                return;
            }
        }
    }

    private getWorkerById(id: number): Worker | undefined {
        return this.workers.find((w) => w.id === id);
    }

    private getAvailableWorker(): Worker | void {
        for (const worker of this.workers) {
            if (worker.isAvailable()) {
                return worker;
            }
        }
    }

    private processQueue(): void {
        const self = this;
        const call = this.queue.shift();

        if (!call) {
            this.debug("No call in queue.");
            return;
        }

        this.startWorkers(); // if some of them died

        function launchCall(worker: Worker): void {
            if (!call) {
                return;
            }

            self.debug("Call %d sent to worker %d.", call.id, worker.id);
            self.pendingCalls.push(call);
            call.launchTimeout();
            worker.run(call); // TODO : send to worker according to parameters
        }

        // TODO : dispatch evenly on workers (we could use internal workers queue length and choose the lesser)

        let interval: any;

        function processCall(): boolean {
            const worker = self.getAvailableWorker();

            if (worker) {
                if (interval) {
                    clearInterval(interval);
                }

                launchCall(worker);
                return  true;
            } else {
                self.debug("No available worker to process a task. Trying next time.");
                return false;
            }
        }

        if (!processCall()) {
            interval = setInterval(processCall, this.options.queueIntervalCheck);
        }
    }

    private listenToWorker(worker: Worker): void {
        worker
            .on("message", async (data: WorkerToMasterMessage) => {
                this.emit("workerMessage", worker.id, await this.receive(data));
            })
            .on("ttlExceeded", () => {
                this.emit("workerTTLExceeded", worker.id);
            })
            .on("disconnect", () => {
                this.emit("workerDisconnect", worker.id);
            })
            .on("error", (err: Error) => {
                this.emit("workerError", worker.id, err);
            })
            .on("close", (code: number, signal: string) => {
                this.emit("workerClose", worker.id, code, signal);
            })
            .on("exit", (code: number, signal: string) => {
                // TODO : Retrieve jobs inside worker that are in a queue and requeue them
                this.emit("workerExit", worker.id, code, signal);
                this.restartWorker(worker.id);
            });
    }

    private startWorkers() {
        for (let i = this.workers.length; i < this.options.numberOfWorkers; i++) {
            this.debug("Starting worker %d of %d.", i + 1, this.options.numberOfWorkers);

            const worker = new Worker(
                this.options.argv,
                this.options.killTimeout,
                this.options.module,
                this.options.fork,
                this.options.ttl,
                this.id,
            );

            this.listenToWorker(worker);
            this.workers.push(worker);
            this.emit("newWorker", worker.id);
        }
    }

    private init(): void {
        this.workers = [];
        this.queue = [];
        this.pendingCalls = [];
        this.startWorkers();
        this.debug("Workers ignited.");
    }
}
