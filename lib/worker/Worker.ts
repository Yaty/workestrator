import {ChildProcess, fork} from "child_process";
import * as logger from "debug";
import {EventEmitter} from "events";
import Call from "../Call";
import {ForkOptions} from "../types";

import {
    MasterToWorkerMessage,
    WorkerToMasterMessage,
} from "../types";

import Serializer from "./serializer/Serializer";
import Timer = NodeJS.Timer;

const runner = require.resolve("./executor");

export default class Worker extends EventEmitter {
    public process: ChildProcess;
    public pendingCalls: number = 0;
    public killed: boolean = false;

    private killing: boolean = false;
    private loaded: boolean = false;
    private readonly debug: logger.IDebugger;
    private idleTimer: Timer;

    constructor(
        private killTimeout: number,
        private module: string,
        private forkOptions: ForkOptions,
        private ttl: number,
        private maxConcurrentCalls: number,
        private maxIdleTime: number,
        private serializer: Serializer,
        private serializerPath: string,
        public id: number,
        farmId: number,
    ) {
        super();
        this.debug = logger(`workestrator:farm:${farmId}:worker:${this.id}`);
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
            args: this.serializer.encode(call.args),
            callId: call.id,
            method: call.method,
            workerId: call.workerId,
        };

        this.ttl--;
        this.pendingCalls++;
        this.process.send(data);
        this.debug("Run call : %o", data);
        return true;
    }

    public kill(signal: string = "SIGINT"): void {
        if (this.killed || this.killing) {
            return;
        }

        this.killing = true;
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
    }

    public isAvailable(): boolean {
        return !this.killed &&
            !this.killing &&
            this.connected &&
            this.loaded &&
            this.ttl > 0 &&
            this.pendingCalls / this.maxConcurrentCalls < 1;
    }

    public get connected(): boolean {
        return this.process.connected;
    }

    private resetIdleTimer(): void {
        if (this.maxIdleTime === Infinity) {
            return;
        }

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            this.debug("Max idle time reached.");
            this.emit("idle");
            this.kill();
        }, this.maxIdleTime);
    }

    private loadModule(): void {
        this.process.send({
            module: this.module,
            serializer: this.serializerPath,
        });
    }

    private init(): void {
        this.process = fork(runner, this.forkOptions.args, this.forkOptions);
        this.debug("Worker ignited.");
    }

    private listen() {
        const messageListener = (data: WorkerToMasterMessage) => {
            this.debug("Worker message event %o", data);

            if (!this.loaded) {
                if (data.moduleLoaded) {
                    this.debug("Module loaded successfully.");
                    this.loaded = true;
                    this.emit("online");
                } else {
                    this.debug("Module failed to load : %o", data.err);
                    // tslint:disable-next-line
                    console.error("Workestrator : Error while loading your module.", data.err);
                }

                return;
            }

            if (data.res) {
                data.res = this.serializer.decode(data.res);
            }

            if (data.err) {
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

                data.err = Object.assign(error, data.err);
            }

            this.pendingCalls--;
            this.emit("message", data);

            this.resetIdleTimer();

            if (this.ttl <= 0 && this.pendingCalls === 0) {
                this.debug("Worker TTL exceeded.");
                this.emit("ttl");
                this.kill();
            }
        };

        // The exit event is emitted after the child process ends.
        const exitListener = (code: number, signal: string) => {
            this.debug("Worker exit event (%d, %s).", code, signal);

            if (this.killing) {
                this.killing = false;
                this.killed = true;
            }

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
        };

        // this.process.setMaxListeners(Infinity);

        this.process
            .once("exit", exitListener)
            .once("disconnect", disconnectListener)
            .on("close", closeListener)
            .on("message", messageListener)
            .on("error", errorListener);

        this.debug("Worker is listening.");
    }
}
