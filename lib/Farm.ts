import * as logger from "debug";
import {EventEmitter} from "events";
import Call from "./Call";
import CallMaxRetryError from "./CallMaxRetryError";

import {
    CallOptions,
    InternalFarmOptions,
    WorkerToMasterMessage,
} from "./types";

import MaxConcurrentCallsError from "./MaxConcurrentCallsError";
import Serializer from "./worker/serializer/Serializer";
import Worker from "./worker/Worker";
import WorkerTerminatedError from "./WorkerTerminatedError";

export default class Farm extends EventEmitter {
    private static farmCount: number = 0;

    public readonly id: number;
    public workers: Worker[] = [];
    public queue: Call[] = [];
    public pendingCalls: Call[] = [];
    public isRunning: boolean = true;

    private serializer: Serializer;
    private readonly debug: logger.IDebugger;
    private workerCounter: number = 0;

    constructor(public options: InternalFarmOptions) {
        super();
        this.id = Farm.farmCount++;
        this.debug = logger("workhorse:farm:" + this.id);
        this.init();
    }

    public run(...args: any[]): Promise<any> {
        return this.runMethod(undefined, ...args);
    }

    public runMethod(method?: string, ...args: any[]): Promise<any> {
        return this.dispatch({
            args,
            method,
            timeout: this.options.timeout,
        });
    }

    public broadcast(...args: any[]): Promise<any[]> {
        return this.broadcastMethod(undefined, ...args);
    }

    public broadcastMethod(method?: string, ...args: any[]): Promise<any[]> {
        const calls = [];

        for (const worker of this.workers) {
            calls.push(this.dispatch({
                args,
                method,
                timeout: this.options.timeout,
                workerId: worker.id,
            }));
        }

        return Promise.all(calls);
    }

    public async kill(): Promise<void> {
        this.isRunning = false;
        await Promise.all(this.workers.map((w) => w.kill()));

        this.workers = [];
        this.queue = [];
        this.pendingCalls = [];

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
                this.options.maxIdleTime,
                this.serializer,
                this.options.serializerPath,
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

    private async receive(data: WorkerToMasterMessage): Promise<void> {
        this.processQueue(); // a worker might now be ready to take a new call
        const call = this.pendingCalls.find((c) => c.id === data.callId);

        if (!call) {
            this.debug("Unknown call received : %o", data);
            return;
        }

        if (data.err) {
            this.debug("Receive error : %o", data.err);
            call.reject(data.err);
        } else {
            this.debug("Receive data : %o", data);
            call.resolve(data.res);
        }
    }

    private dispatch(options: CallOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.queue.length + this.pendingCalls.length >= this.options.maxConcurrentCalls) {
                this.debug("Max concurrent calls reached. Retrying later.");
                return reject(new MaxConcurrentCallsError());
            }

            const call: Call = new Call(options, (res?: any) => {
                this.debug("Resolve call %d with : %o", call.id, res);
                this.removeCallFromPending(call.id);
                return resolve(res);
            }, (err: Error) => {
                this.debug("Call %d failed on attempt %d with : %o", call.id, call.retries + 1, err);
                this.removeCallFromPending(call.id);

                // When the call failed and that there is no retry then we directly reject the error
                if (this.options.maxRetries === 0) {
                    this.debug("Reject call %d with : %o", call.id, err);
                    return reject(err);
                }

                // When a call have been retried too much
                if (call.retries >= this.options.maxRetries) {
                    this.debug("Reject call with max retry limit reached %d : %o", call.id, err);
                    return reject(new CallMaxRetryError(err));
                }

                // Retry a call
                call.retry();
                this.debug("Retrying the call %d (%d / %d).", call.id, call.retries, this.options.maxRetries);
                this.queue.unshift(call);
                this.processQueue();
            });

            this.debug("Dispatch %o", call);
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
        if (!this.isRunning) { // Do not recreate when the farm is off
            return;
        }

        const workerIndex = this.workers.findIndex((w) => w.id === id);

        if (workerIndex > -1) {
            const worker = this.workers[workerIndex];

            // Requeue calls from killed worker
            for (let i = 0; i < this.pendingCalls.length; i++) {
                const pendingCall = this.pendingCalls[i];

                if (pendingCall.workerId === worker.id) {
                    pendingCall.reject(new WorkerTerminatedError());
                    worker.pendingCalls--;
                    i--; // rejecting the call removed it from pendingCalls, so we have to go back
                }
            }

            this.workers.splice(workerIndex, 1);
            this.debug("Worker %d removed.", id);
        }

        this.createWorkers();
    }

    private getWorkerById(id: any): Worker | void {
        if (typeof id !== "number") {
            return;
        }

        return this.workers.find((w) => w.id === id);
    }

    private getAvailableWorker(): Worker | void {
        return this.workers.reduce((bestWorker: Worker | void, worker: Worker) => {
            if (!bestWorker) {
                if (worker.isAvailable()) {
                    return worker;
                }

                return;
            }

            if (worker.isAvailable() && worker.pendingCalls < bestWorker.pendingCalls) {
                return worker;
            }

            return bestWorker;
        }, undefined);
    }

    private isPoolAvailable(): boolean {
        for (const worker of this.workers) {
            if (worker.isAvailable()) {
                return true;
            }
        }

        return false;
    }

    private processQueue(): void {
        if (!this.isPoolAvailable()) {
            return;
        }

        for (let i = 0; i < this.queue.length; i++) {
            const call: Call = this.queue[i];
            const worker: Worker | void = this.getWorkerById(call.workerId) || this.getAvailableWorker();

            if (worker && worker.run(call)) {
                this.debug("Call %d sent to worker %d successfully.", call.id, worker.id);

                call.launchTimeout(() => {
                    this.debug("Call %d on worker %d has timed out. Killing the worker.", call.id, call.workerId);
                    worker.kill(); // call will be re-dispatched to another worker according to the policy
                });

                this.pendingCalls.push(call);
                this.queue.splice(i, 1);
                i--; // the queue lost a call so make one step back
            } else {
                this.debug("Call %d not executed.", call.id);
            }
        }
    }

    private listenToWorker(worker: Worker): void {
        worker
            .on("message", async (data: WorkerToMasterMessage) => {
                await this.receive(data);
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
                this.rotateWorker(worker.id);
                this.emit("workerExit", worker.id, code, signal);
            })
            .on("killed", () => {
                this.emit("workerKilled", worker.id);
            })
            .on("moduleLoaded", () => {
                this.processQueue(); // some calls are maybe waiting
                this.emit("workerModuleLoaded", worker.id);
            })
            .on("maxIdleTime", () => {
                this.emit("workerMaxIdleTime", worker.id);
            });
    }

    private init(): void {
        const Srlz = require(this.options.serializerPath);
        this.serializer = new Srlz();
        this.createWorkers();
        this.debug("Workers ignited.");
    }
}
