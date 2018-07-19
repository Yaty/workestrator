import logger, {IDebugger} from "debug";
import {EventEmitter} from "events";
import Call from "./Call";
import CallMaxRetryError from "./CallMaxRetryError";

import {
    CallOptions,
    InternalFarmOptions,
    WorkerToMasterMessage,
} from "./types";

import MaxConcurrentCallsError from "./MaxConcurrentCallsError";
import TimeoutError from "./TimeoutError";
import * as utils from "./utils";
import Worker from "./worker/Worker";
import WorkerTerminatedError from "./WorkerTerminatedError";

export default class Farm extends EventEmitter {
    private static farmCount: number = 0;

    public readonly id: number;
    public workers: Worker[] = [];
    public queue: Call[] = [];
    public pendingCalls: Call[] = [];
    public isRunning: boolean = true;

    private readonly debug: IDebugger;
    private workerCounter: number = 0;

    constructor(public options: InternalFarmOptions) {
        super();
        this.id = Farm.farmCount++;
        this.debug = logger("workhorse:farm:" + this.id);
        this.init();
    }

    public run(...args: any[]): Promise<any> {
        return this.dispatch({
            args,
            timeout: this.options.timeout,
        });
    }

    public runMethod(method: string, ...args: any[]): Promise<any> {
        return this.dispatch({
            args,
            method,
            timeout: this.options.timeout,
        });
    }

    public async kill(): Promise<void> {
        this.isRunning = false;
        await Promise.all(this.workers.map((w) => w.kill()));
        utils.removeElements(this.workers, this.queue, this.pendingCalls);
        this.emit("killed");
        this.debug("Farm killed.");
    }

    public createWorkers(): void {
        if (!this.isRunning) { // ending, do not recreate workers
            return;
        }

        for (let i = this.workers.length; i < this.options.numberOfWorkers; i++) {
            this.debug("Creating worker %d of %d.", i + 1, this.options.numberOfWorkers);

            const worker = new Worker(
                this.options.killTimeout,
                this.options.module,
                this.options.fork,
                this.options.ttl,
                this.options.maxConcurrentCallsPerWorker,
                this.workerCounter++,
                this.id,
            );

            this.listenToWorker(worker);
            this.workers.push(worker);
            this.debug("Worker %d (id: %d) created.", i + 1, worker.id);
            this.emit("newWorker", worker.id, worker.process.pid);
        }
    }

    private removeCallFromPending(callId: number): Call | void {
        const callIndex = this.pendingCalls.findIndex((c: Call) => c.id === callId);

        if (callIndex === -1) {
            this.debug("Call %d not found in pending.", callId);
            return;
        }

        this.debug("Remove call %d from pending.", callId);
        const call = this.pendingCalls[callIndex];
        this.pendingCalls.splice(callIndex, 1);
        return call;
    }

    private receive(data: WorkerToMasterMessage): void {
        const call = this.removeCallFromPending(data.callId);

        if (!call) {
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

        this.processQueue(); // a worker might now be ready to take a new call
    }

    private dispatch(options: CallOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            this.debug("Dispatch %o", options);

            if (this.queue.length + this.pendingCalls.length >= this.options.maxConcurrentCalls) {
                this.debug("Max concurrent calls reached. Retrying later.");
                return reject(new MaxConcurrentCallsError());
            }

            const call = new Call(options, resolve, async (err: Error) => {
                this.removeCallFromPending(call.id);

                // If a timeout occur then the worker is certainly in a blocking state
                // So we have to kill it (a new worker will be created automatically)
                if (err instanceof TimeoutError) {
                    const worker = this.getWorkerById(call.workerId);

                    if (worker) {
                        this.debug("Call %d on worker %d has timed out. Killing the worker.", call.id, call.workerId);
                        await worker.kill();
                    } else {
                        this.createWorkers();
                    }

                    return reject(err);
                }

                // When the call failed and that there is no retry then
                // we directly reject the error
                if (this.options.maxRetries === 0) {
                    return reject(err);
                }

                // When a call have been retried too much
                if (call.retries >= this.options.maxRetries) {
                    this.debug("Max retry limit reached on call %d.", call.id);
                    return reject(new CallMaxRetryError(err));
                }

                // Retry a call until it succeed or until the retry limit
                this.debug("Retrying the call %d (%d / %d).", call.id, call.retries + 1, this.options.maxRetries);
                call.retry();
                this.requeueCall(call);
                this.processQueue();
            });

            this.queue.push(call);
            this.processQueue();
        });
    }

    /**
     * Will remove a worker from the farm
     * and create a new one
     * @param {number} id
     */
    private rotateWorker(id: number): void {
        const workerIndex = this.workers.findIndex((w) => w.id === id);

        if (workerIndex > -1) {
            this.debug("Worker %d removed.", id);
            this.workers.splice(workerIndex, 1);
        }

        this.createWorkers();
    }

    private getWorkerById(id: number): Worker | void {
        return this.workers.find((w) => w.id === id);
    }

    private getAvailableWorker(): Worker | null {
        return this.workers.reduce((bestWorker: Worker | null, worker: Worker) => {
            if (!bestWorker) {
                if (worker.isAvailable()) {
                    return worker;
                }

                return null;
            }

            if (worker.isAvailable() && worker.getLoad() < bestWorker.getLoad()) {
                return worker;
            }

            return bestWorker;
        }, null);
    }

    private requeueCall(call: Call): void {
        this.queue.unshift(call);
    }

    private processQueue(): void {
        const call = this.queue.shift();

        if (!call) {
            this.debug("No call in queue.");
            return;
        }

        this.createWorkers(); // if some of them died
        const worker = this.getAvailableWorker();

        if (worker && worker.run(call)) {
            this.debug("Call %d sent to worker successfully %d.", call.id, worker.id);
            this.pendingCalls.push(call);
        } else {
            this.debug("Call %d not taken by workers for this time. Retrying later.", call.id);
            this.requeueCall(call);
        }

        // If no worker is available then the queue will be processed latter when a worker will be ready
    }

    private listenToWorker(worker: Worker): void {
        worker
            .on("message", async (data: WorkerToMasterMessage) => {
                this.receive(data);
                this.emit("workerMessage", worker.id, data);
            })
            .on("TTLExceeded", () => {
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
                this.emit("workerExit", worker.id, code, signal);

                if (!this.isRunning) {
                    return;
                }

                // Recreate a worker
                this.rotateWorker(worker.id);

                // Requeue calls from killed worker
                for (let i = 0; i < this.pendingCalls.length; i++) {
                    if (this.pendingCalls[i].workerId === worker.id) {
                        this.pendingCalls[i].reject(new WorkerTerminatedError());
                        worker.pendingCalls--;
                        i--; // reject will remove the call from pendingCalls
                    }
                }
            })
            .on("killed", () => {
                this.emit("workerKilled", worker.id);
            });
    }

    private init(): void {
        this.createWorkers();
        this.debug("Workers ignited.");
    }
}
