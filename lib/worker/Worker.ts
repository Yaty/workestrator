import {ChildProcess, fork} from "child_process";
import * as logger from "debug";
import {EventEmitter} from "events";
import Call from "../Call";
import {ForkOptions} from "../types";

import {
    MasterToWorkerMessage,
    WorkerToMasterMessage,
} from "../types";

const runner = require.resolve("./executor");

export default class Worker extends EventEmitter {
    public killed: boolean = false;
    public process: ChildProcess;
    public pendingCalls: number = 0;

    private killing: boolean = false;
    private moduleLoaded: boolean = false;
    private readonly debug: logger.IDebugger;

    constructor(
        private killTimeout: number,
        private module: string,
        private forkOptions: ForkOptions,
        private ttl: number,
        private maxConcurrentCalls: number,
        public id: number,
        farmId: number,
    ) {
        super();
        this.debug = logger(`workhorse:farm:${farmId}:worker:${this.id}`);
        this.init();
        this.listen();
        this.loadModule();
    }

    public run(call: Call): boolean {
        if (!this.isAvailable()) {
            return false;
        }

        call.workerId = this.id;

        const data: MasterToWorkerMessage = {
            args: call.args,
            callId: call.id,
            method: call.method,
            workerId: call.workerId,
        };

        this.ttl--;
        this.pendingCalls++;
        call.launchTimeout();
        this.process.send(data);
        this.debug("Run call : %o", data);
        return true;
    }

    public kill(signal: string = "SIGINT"): Promise<void> {
        if (this.killed || this.killing) {
            return Promise.resolve();
        }

        this.killing = true;

        const setKilled = (resolve: () => any) => {
            this.debug("Worker killed.");
            this.killed = true;
            this.killing = false;
            // this.process.removeAllListeners();
            this.emit("killed");
            this.removeAllListeners();
            resolve();
        };

        const resolveWhenKilled = (resolve: () => any) => {
            let exited = false;
            let disconnected = false;
            let closed = false;

            const check = () => {
                this.debug(
                    "Kill check (%d / 3).",
                    [exited, disconnected, closed].reduce((acc, value) => acc + Number(value), 0),
                );

                if (exited && disconnected && closed) {
                    setKilled(resolve);
                }
            };

            this.process.once("exit", () => {
                this.debug("Exit event received after killing.");
                exited = true;
                check();
            });

            this.process.once("disconnect", () => {
                this.debug("Disconnect event received after killing.");
                disconnected = true;
                check();
            });

            this.process.once("close", () => {
                this.debug("Close event received after killing.");
                closed = true;
                check();
            });
        };

        return new Promise((resolve) => {
            resolveWhenKilled(resolve);

            this.debug("Killing worker with signal %s.", signal);
            this.process.kill(signal);

            if (this.killTimeout === Infinity) {
                return;
            }

            setTimeout(() => {
                if (!this.killed) {
                    this.debug(
                        "Worker not exited from %s in %d ms, forcing a kill with SIGKILL",
                        signal,
                        this.killTimeout,
                    );

                    this.process.kill("SIGKILL");
                }
            }, this.killTimeout);
        });
    }

    public getLoad() {
        return this.pendingCalls / this.maxConcurrentCalls;
    }

    public isAvailable(): boolean {
        return !this.killed &&
            !this.killing &&
            this.moduleLoaded &&
            this.ttl > 0 &&
            this.getLoad() < 1;
    }

    private loadModule(): void {
        this.process.send({
            module: this.module,
        });
    }

    private init(): void {
        this.process = fork(runner, this.forkOptions.args, this.forkOptions);
        this.debug("Worker ignited.");
    }

    private listen() {
        const messageListener = async (data: WorkerToMasterMessage) => {
            this.debug("Worker message event %o", data);

            if (!this.moduleLoaded) {
                if (data.moduleLoaded) {
                    this.debug("Module loaded successfully.");
                    this.moduleLoaded = true;
                    this.emit("moduleLoaded");
                } else {
                    this.debug("Module failed to load : %o", data.err);
                    // tslint:disable-next-line
                    console.error("Workhorse : Error while loading your module.", data.err);
                }

                this.emit("message", data);
                return;
            }

            this.pendingCalls--;
            this.emit("message", data);

            if (this.ttl <= 0) {
                this.debug("Worker TTL exceeded.");
                this.emit("TTLExceeded");
                await this.kill();
            }
        };

        // The exit event is emitted after the child process ends.
        const exitListener = (code: number, signal: string) => {
            this.debug("Worker exit event (%d, %s).", code, signal);
            this.emit("exit", code, signal);
        };

        // The close event is emitted when the stdio streams have been closed.
        const closeListener = (code: number, signal: string) => {
            this.debug("Worker close event (%d, %s).", code, signal);
            this.emit("close", code, signal);
        };

        // The disconnect event is emitted after calling
        // the subprocess.disconnect() method in parent process
        // or process.disconnect() in child process.
        const disconnectListener = () => {
            this.debug("Worker disconnect event.");
            this.emit("disconnect");
        };

        const errorListener = (err: Error) => {
            this.debug("Error : %o", err);
            this.emit("error", err);
            // an error might raise the exit event
        };

        // this.process.setMaxListeners(Infinity);

        this.process
            .on("exit", exitListener)
            .on("disconnect", disconnectListener)
            .on("close", closeListener)
            .on("message", messageListener)
            .on("error", errorListener);

        this.debug("Worker is listening.");
    }
}
