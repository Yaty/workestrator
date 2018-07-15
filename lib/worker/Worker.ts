import {ChildProcess, fork, ForkOptions} from "child_process";
import logger, {IDebugger} from "debug";
import {EventEmitter} from "events";
import Call from "../Call";

import {
    MasterToWorkerMessage,
    WorkerToMasterMessage,
} from "../types";

const runner = require.resolve("./executor");

export default class Worker extends EventEmitter {
    public exited: boolean = false;
    public process: ChildProcess;
    public pendingCalls: number = 0;

    private readonly debug: IDebugger;
    private killing: boolean = false;

    constructor(
        private argv: string[],
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

        this.debug("Run call : %o", data);
        this.ttl--;
        this.pendingCalls++;
        call.launchTimeout();
        this.process.send(data);
        return true;
    }

    public get killed(): boolean {
        return this.process.killed;
    }

    public kill(signal: string = "SIGINT"): Promise<void> {
        return new Promise((resolve) => {
            this.killing = true;
            this.on("kill", resolve);
            this.debug("Killing worker with signal %s.", signal);
            this.process.kill(signal);

            if (this.killTimeout === Infinity) {
                return;
            }

            setTimeout(() => {
                if (!this.exited) {
                    this.debug("Worker not exited from %s, forcing a kill with SIGKILL", signal);
                    this.process.kill("SIGKILL");
                }
            }, this.killTimeout);
        });
    }

    public getLoad() {
        return this.pendingCalls / this.maxConcurrentCalls;
    }

    public isAvailable(): boolean {
        return this.ttl > 0 && this.getLoad() < 1;
    }

    private init(): void {
        this.process = fork(runner, this.argv, this.forkOptions);

        this.process.send({
            module: this.module,
        });

        this.debug("Worker ignited.");
    }

    private listen() {
        const messageListener = async (data: WorkerToMasterMessage) => {
            this.debug("Worker message event %o", data);
            this.pendingCalls--;
            this.emit("message", data);

            if (this.ttl <= 0) {
                this.debug("Worker TTL exceeded.");
                this.emit("ttlExceeded");
                await this.kill();
            }
        };

        // The exit event is emitted after the child process ends.
        const exitListener = (code: number, signal: string) => {
            this.debug("Worker exit event (%d, %s).", code, signal);
            this.exited = true;
            this.emit("exit", code, signal);

            if (this.killing) {
                this.killing = false;
                this.emit("kill");
            }
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

        (this.process as NodeJS.EventEmitter)
            .once("exit", exitListener)
            .once("disconnect", disconnectListener)
            .once("close", closeListener)
            .on("message", messageListener)
            .on("error", errorListener);

        this.debug("Worker is listening.");
    }
}
