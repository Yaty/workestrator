import {expect} from "chai";
import path from "path";
import {create, kill} from "../lib";
import WritableStream = NodeJS.WritableStream;
import ReadableStream = NodeJS.ReadableStream;

const childPath = require.resolve("./child");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Fork", () => {
    after(kill);

    it("should use cwd", async () => {
        const cwd = path.resolve(__dirname, "../examples");

        const farm = create({
            fork: {
                cwd,
            },
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.cwd).to.equal(cwd);
    });

    it("should use env", async () => {
        const env = {
            foo: "bar",
        };

        const farm = create({
            fork: {
                env,
            },
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.env.foo).to.equal("bar");
    });

    it("should use execPath", async () => {
        const execPath = process.execPath;

        const farm = create({
            fork: {
                execPath,
            },
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.execPath).to.equal(execPath);
    });

    it("should use execArgv", async () => {
        const execArgv = ["--expose-gc", "--harmony"];

        const farm = create({
            fork: {
                execArgv,
            },
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.execArgv).to.deep.equal(execArgv);
    });

    it("should use argv", async () => {
        const argv = ["0", "1"];

        const farm = create({
            argv,
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.argv).to.deep.equal([
            process.execPath,
            path.resolve(__dirname, "../lib/worker/executor.js"),
            ...argv,
        ]);
    });

    describe("stdio", () => {
        let stdout: any;
        let stderr: any;

        function captureWritableStream(stream: WritableStream) {
            const  oldWrite = stream.write;
            let buf = "";

            // tslint:disable-next-line
            stream.write = function(chunk: any, encodingOrCB?: string | Function, cb?: Function): boolean {
                buf += chunk.toString();

                if (typeof encodingOrCB === "string") {
                    return oldWrite.apply(stream, [chunk, encodingOrCB, cb]);
                } else {
                    return oldWrite.apply(stream, [chunk, encodingOrCB]);
                }
            };

            return {
                unhook() {
                    stream.write = oldWrite;
                },
                captured() {
                    return buf;
                },
                reset() {
                    buf = "";
                },
            };
        }

        function captureReadableStream(stream: ReadableStream) {
            let buf = "";

            stream.on("data", (data) => {
                buf += data.toString();
            });

            return {
                captured() {
                    return buf;
                },
                reset() {
                    buf = "";
                },
            };
        }

        before(() => {
            stdout = captureWritableStream(process.stdout);
            stderr = captureWritableStream(process.stderr);
        });

        afterEach(() => {
            stdout.reset();
            stderr.reset();
        });

        after(() => {
            stdout.unhook();
            stderr.unhook();
        });

        it("should be silent", async () => {
            const farm = create({
                fork: {
                    silent: true,
                },
                module: childPath,
            });

            const [worker] = farm.workers;
            expect(worker.process.stdout).to.not.be.null;
            expect(worker.process.stderr).to.not.be.null;
            expect(worker.process.stdin).to.not.be.null;

            const workerStdErr = captureReadableStream(worker.process.stderr);
            const workerStdOut = captureReadableStream(worker.process.stdout);

            await farm.runMethod("std");
            await sleep(500);

            expect(stdout.captured()).to.not.include("stdout\n");
            expect(stderr.captured()).to.not.include("stderr\n");
            expect(workerStdErr.captured()).to.equal("stderr\n");
            expect(workerStdOut.captured()).to.equal("stdout\n");
        });

        it("shouldn't be silent", () => {
            const farm = create({
                fork: {
                    silent: false,
                },
                module: childPath,
            });

            // I haven't found a way to test that stdio in parent is filled
            // Parent process stdio are empty but the console still have some data :/
            const [worker] = farm.workers;
            expect(worker.process.stdout).to.be.null;
            expect(worker.process.stderr).to.be.null;
            expect(worker.process.stdin).to.be.null;
        });

        it("should be configurable with stdio array", async () => {
            const farm = create({
                fork: {
                    stdio: ["pipe", "inherit", process.stderr, "ipc"], // a fork must have one IPC channel
                },
                module: childPath,
            });

            const [worker] = farm.workers;
            expect(worker.process.stdout).to.be.null;
            expect(worker.process.stderr).to.be.null;
            expect(worker.process.stdin).to.not.be.null;

            await farm.runMethod("std");
            await sleep(500);

            expect(stdout.captured()).to.not.include("stdout\n");
            expect(stderr.captured()).to.not.include("stderr\n");
        });
    });
});
