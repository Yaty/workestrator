import {AssertionError} from "assert";
import chai, {expect} from "chai";
import {ForkOptions} from "child_process";
import "mocha";
import path from "path";
import sinonChai from "sinon-chai";
import Farm from "../lib/Farm";
import {create, kill} from "../lib/index";
import WritableStream = NodeJS.WritableStream;
import ReadableStream = NodeJS.ReadableStream;

chai.use(sinonChai);

const childPath = require.resolve("./child");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Workhorse", () => {
    describe("Factory", () => {
        it("should create a farm", async () => {
            const farm = create({
                module: childPath,
            });

            expect(farm.running).to.be.true;
            await farm.kill();
        });

        it("should kill a farm", async () => {
            const farm = create({
                module: childPath,
            });

            await farm.kill();
            expect(farm.running).to.be.false;
        });

        it("should kill all farms", async () => {
            const farm = create({
                module: childPath,
            });

            await kill();
            expect(farm.running).to.be.false;
        });
    });

    describe("Validation", () => {
        [undefined, null, 0, [], ""].forEach((options) => {
            it(`should'nt allow '${typeof options}' options : ${options}`, () => {
                expect(() => create(options as any)).to.throw(AssertionError);
            });
        });

        it("should allow an object as options", () => {
            expect(() => create({
                module: childPath,
            })).to.not.throw;
        });

        [-1, 0, [], {}].forEach((maxConcurrentCalls) => {
            it(`should'nt allow '${typeof maxConcurrentCalls}' maxConcurrentCalls : ${maxConcurrentCalls}`, () => {
                expect(() => create({
                    maxConcurrentCalls: maxConcurrentCalls as any,
                    module: childPath,
                })).to.throw(AssertionError);
            });
        });

        it("should allow maxConcurrentCalls > 0", () => {
            expect(() => create({
                maxConcurrentCalls: 1,
                module: childPath,
            })).to.not.throw;
        });

        [-1, 0, [], {}].forEach((maxConcurrentCallsPerWorker) => {
            it(`should'nt allow '${typeof maxConcurrentCallsPerWorker}' ` +
                `maxConcurrentCallsPerWorker : ${maxConcurrentCallsPerWorker}`,
                () => {
                    expect(() => create({
                        maxConcurrentCallsPerWorker: maxConcurrentCallsPerWorker as any,
                        module: childPath,
                    })).to.throw(AssertionError);
                },
            );
        });

        it("should allow maxConcurrentCallsPerWorker > 0", () => {
            expect(() => create({
                maxConcurrentCallsPerWorker: 1,
                module: childPath,
            })).to.not.throw;
        });

        [-1, [], {}].forEach((maxRetries) => {
            it(`should'nt allow '${typeof maxRetries}' maxRetries : ${maxRetries}`, () => {
                expect(() => create({
                    maxRetries: maxRetries as any,
                    module: childPath,
                })).to.throw(AssertionError);
            });
        });

        it("should allow maxRetries >= 0", () => {
            expect(() => create({
                maxRetries: 0,
                module: childPath,
            })).to.not.throw;
        });

        [-1, 0, [], {}].forEach((numberOfWorkers) => {
            it(`should'nt allow '${typeof numberOfWorkers}' numberOfWorkers : ${numberOfWorkers}`, () => {
                expect(() => create({
                    module: childPath,
                    numberOfWorkers: numberOfWorkers as any,
                })).to.throw(AssertionError);
            });
        });

        it("should allow numberOfWorkers > 0", () => {
            expect(() => create({
                module: childPath,
                numberOfWorkers: 1,
            })).to.not.throw;
        });

        [-1, 0, [], {}, ""].forEach((ttl) => {
            it(`shouldn't allow '${typeof ttl}' ttl : ${ttl}`, () => {
                expect(() => create({
                    module: childPath,
                    ttl: ttl as any,
                })).to.throw(AssertionError);
            });
        });

        it("should allow ttl > 0", () => {
            expect(() => create({
                module: childPath,
                ttl: 1,
            })).to.not.throw;
        });

        [-1, 0, [], {}].forEach((timeout) => {
            it(`should'nt allow '${typeof timeout}' timeout : ${timeout}`, () => {
                expect(() => create({
                    module: childPath,
                    timeout: timeout as any,
                })).to.throw(AssertionError);
            });
        });

        it("should allow timeout > 0", () => {
            expect(() => create({
                module: childPath,
                timeout: 1,
            })).to.not.throw;
        });

        [-1, 0, [], {}].forEach((killTimeout) => {
            it(`should'nt allow '${typeof killTimeout}' killTimeout : ${killTimeout}`, () => {
                expect(() => create({
                    killTimeout: killTimeout as any,
                    module: childPath,
                })).to.throw(AssertionError);
            });
        });

        it("should allow killTimeout > 0", () => {
            expect(() => create({
                killTimeout: 1,
                module: childPath,
            })).to.not.throw;
        });

        [path.resolve(__dirname, "../test"), path.resolve(__dirname, "./do_not_exists"), [], {}, undefined, null]
            .forEach((module) => {
                it(`should'nt allow '${typeof module}' module : ${module}`, () => {
                    expect(() => create({
                        module: module as any,
                    })).to.throw(AssertionError);
                });
            });

        it("should allow module as an existing file", () => {
            expect(() => create({
                module: childPath,
            })).to.not.throw;
        });
    });

    describe("Functions", () => {
        let farm: Farm;

        beforeEach(() => {
            farm = create({
                module: childPath,
            });
        });

        afterEach(async () => {
            await farm.kill();
        });

        it("exports = function", async function() {
            const {pid, rnd}  = await farm.run(0);

            expect(pid).to.be.a("number");
            expect(rnd).to.within(0, 1);
        });

        it("exports = function with args", async function() {
            const {args}  = await farm.run(0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });

        it("exports.fn = function", async function() {
            const {pid, rnd}  = await farm.runMethod("run0");

            expect(pid).to.be.a("number");
            expect(rnd).to.within(0, 1);
        });

        it("exports.fn = function with args", async function() {
            const {args} = await farm.runMethod("data", 0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });
    });

    describe("Constraints", () => {
        it("should respect maxRetries", async () => {
            const maxRetries = 2;

            const farm = create({
                maxRetries,
                module: childPath,
                numberOfWorkers: 1,
            });

            try {
                await farm.runMethod("err");
            } catch (err) {
                expect(err.name).to.equal("CallMaxRetryError");
            } finally {
                await farm.kill();
            }
        });

        it("should respect numberOfWorkers", async () => {
            const numberOfWorkers = 2;

            const farm = create({
                module: childPath,
                numberOfWorkers,
            });

            expect(farm.workers).to.have.lengthOf(numberOfWorkers);
            await farm.kill();
        });

        it("should respect ttl", function(done) {
            (async () => {
                try {
                    const ttl = 3;

                    const farm = create({
                        module: childPath,
                        numberOfWorkers: 1,
                        ttl,
                    });

                    const [{id}] = farm.workers;

                    farm.on("workerTTLExceeded", async (workerId) => {
                        try {
                            if (workerId === id) {
                                await farm.kill();
                                done();
                            }
                        } catch (err) {
                            done(err);
                        }
                    });

                    for (let j = 0; j < ttl; j++) {
                        await farm.run();
                    }
                } catch (err) {
                    done(err);
                }
            })();
        });

        it("should respect timeout", async () => {
            const timeout = 500;

            const farm = create({
                module: childPath,
                numberOfWorkers: 1,
                timeout,
            });

            const startTime = process.hrtime();

            try {
                await farm.runMethod("block");
                throw new Error("should have timeout");
            } catch (err) {
                expect(err.name).to.equal("TimeoutError");
            } finally {
                const endTime = process.hrtime(startTime);
                const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                expect(diff).to.be.at.least(timeout);
                await farm.kill();
            }
        });

        it("should respect maxConcurrentCallsPerWorker", async () => {
            const maxConcurrentCallsPerWorker = 2;
            const numberOfWorkers = 2;

            const farm = create({
                maxConcurrentCallsPerWorker,
                module: childPath,
                numberOfWorkers,
                timeout: Infinity,
            });

            const [firstWorker, secondWorker] = farm.workers;
            const overload = 2;
            const numberOfTasks = maxConcurrentCallsPerWorker * numberOfWorkers + overload;

            for (let i = 0; i < numberOfTasks; i++) {
                // we deliberately omit to wait the promise because there will never resolve for the test
                farm.runMethod("block");
            }

            expect(farm.queue).to.have.lengthOf(overload);
            expect(farm.pendingCalls).to.have.lengthOf(numberOfTasks - overload);
            expect(firstWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
            expect(secondWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);

            await farm.kill();
        });

        it("should respect maxConcurrentCalls", async () => {
            const maxConcurrentCalls = 2;
            const numberOfWorkers = 2;

            const farm = create({
                maxConcurrentCalls,
                module: childPath,
                numberOfWorkers,
                timeout: Infinity,
            });

            const [firstWorker, secondWorker] = farm.workers;
            const overload = 2;
            const numberOfTasks = maxConcurrentCalls * numberOfWorkers + overload;

            for (let i = 0; i < numberOfTasks; i++) {
                // we deliberately omit to wait the promise because there will never resolve for the test
                farm.runMethod("block");
            }

            expect(farm.queue).to.have.lengthOf(numberOfTasks - maxConcurrentCalls);
            expect(farm.pendingCalls).to.have.lengthOf(maxConcurrentCalls);
            expect(firstWorker.pendingCalls).to.equal(maxConcurrentCalls / numberOfWorkers);
            expect(secondWorker.pendingCalls).to.equal(maxConcurrentCalls / numberOfWorkers);

            await farm.kill();
        });

        it("should respect kill timeout if SIGINT doesn't work", (done) => {
            (async () => {
                try {
                    const killTimeout = 1000;

                    const farm = create({
                        killTimeout,
                        module: require.resolve("./child2"),
                        numberOfWorkers: 1,
                    });

                    const startTime = process.hrtime();
                    const [worker] = farm.workers;

                    expect(await farm.run()).to.equal(0); // we have to run it in order to the child to omit SIGINT

                    farm.on("workerExit", async (workerId) => {
                        try {
                            expect(workerId).to.equal(worker.id);
                            const endTime = process.hrtime(startTime);
                            const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                            expect(diff).to.be.at.least(killTimeout);
                            await farm.kill();
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    await worker.kill();
                } catch (err) {
                    done(err);
                }
            })();
        });

        it("should'nt respect kill timeout if SIGINT work", (done) => {
            (async () => {
                try {
                    const killTimeout = 100;

                    const farm = create({
                        killTimeout,
                        module: childPath,
                        numberOfWorkers: 1,
                    });

                    const [worker] = farm.workers;
                    await farm.run();

                    const startTime = process.hrtime();

                    farm.on("workerExit", async (workerId) => {
                        try {
                            expect(workerId).to.equal(worker.id);
                            const endTime = process.hrtime(startTime);
                            const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                            expect(diff).to.be.lessThan(killTimeout);
                            await farm.kill();
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    await worker.kill();
                } catch (err) {
                    done(err);
                }
            })();
        });
    });

    describe("Performance", () => {
        // it("finds pi quickly", () => {});
        // it("should balance calls between workers according to the availability", () => {});
    });

    describe("Resilience", () => {
        it("should restart a new worker after a TTL", (done) => {
            (async () => {
                try {
                    const ttl = 1;

                    const farm = create({
                        module: childPath,
                        numberOfWorkers: 1,
                        ttl,
                    });

                    const [firstWorker] = farm.workers;

                    farm.on("newWorker", async (workerId) => {
                        try {
                            const [newWorker] = farm.workers;
                            expect(firstWorker.killed).to.be.true;
                            expect(firstWorker.exited).to.be.true;
                            expect(firstWorker.id).to.not.equal(workerId);
                            expect(workerId).to.equal(newWorker.id);
                            await farm.kill();
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    for (let j = 0; j < ttl; j++) {
                        await farm.run();
                    }
                } catch (err) {
                    done(err);
                }
            })();
        });

        it("should restart a new worker after a timeout", (done) => {
            (async () => {
                try {
                    const timeout = 500;

                    const farm = create({
                        module: childPath,
                        numberOfWorkers: 1,
                        timeout,
                    });

                    const [firstWorker] = farm.workers;

                    farm.on("newWorker", async (workerId) => {
                        try {
                            const [newWorker] = farm.workers;
                            expect(firstWorker.killed).to.be.true;
                            expect(firstWorker.exited).to.be.true;
                            expect(firstWorker.id).to.not.equal(workerId);
                            expect(workerId).to.equal(newWorker.id);
                            await farm.kill();
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });

                    try {
                        await farm.runMethod("block");
                    } catch (err) {
                        expect(err.name).to.equal("TimeoutError");
                    }
                } catch (err) {
                    done(err);
                }
            })();
        });

        // when using a timeout it will kill the worker no matter what the signal is once timed out
        [
            "SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGABRT", "SIGFPE", "SIGKILL",
            "SIGSEGV", "SIGPIPE", "SIGALRM", "SIGTERM", "SIGUSR1", "SIGUSR2",
            "SIGCHLD", "SIGCONT", "SIGSTOP", "SIGTSTP", "SIGTTIN", "SIGTTOU",
        ].forEach((signal) => {
            it(`should restart a worker on ${signal} when using kill method with timeout`, (done) => {
                (async () => {
                    try {
                        const farm = create({
                            killTimeout: 100,
                            module: childPath,
                            numberOfWorkers: 1,
                        });

                        const [firstWorker] = farm.workers;
                        let newWorkerCreated = false;

                        farm.once("workerKill", async (workerId) => {
                            try {
                                expect(newWorkerCreated).to.be.true;
                                expect(workerId).to.equal(firstWorker.id);
                                expect(firstWorker.killed).to.be.true;
                                expect(firstWorker.exited).to.be.true;
                                await farm.kill();
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });

                        farm.once("newWorker", (workerId) => {
                            const [newWorker] = farm.workers;
                            expect(firstWorker.id).to.not.equal(workerId);
                            expect(workerId).to.equal(newWorker.id);
                            newWorkerCreated = true;
                        });

                        await firstWorker.kill(signal);
                    } catch (err) {
                        done(err);
                    }
                })();
            });
        });

        [ // those signal should kill the worker in one shot
            "SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGABRT",
            "SIGFPE", "SIGKILL", "SIGSEGV", "SIGALRM", "SIGTERM", "SIGUSR1", "SIGUSR2",
        ].forEach((signal) => {
            it(`should restart a worker on ${signal} when using kill method without timeout`, (done) => {
                (async () => {
                    try {
                        const farm = create({
                            killTimeout: Infinity,
                            module: childPath,
                            numberOfWorkers: 1,
                        });

                        const [firstWorker] = farm.workers;
                        let newWorkerCreated = false;

                        farm.once("workerKill", async (workerId) => {
                            try {
                                expect(newWorkerCreated).to.be.true;
                                expect(workerId).to.equal(firstWorker.id);
                                expect(firstWorker.killed).to.be.true;
                                expect(firstWorker.exited).to.be.true;
                                await farm.kill();
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });

                        farm.once("newWorker", (workerId) => {
                            const [newWorker] = farm.workers;
                            expect(firstWorker.id).to.not.equal(workerId);
                            expect(workerId).to.equal(newWorker.id);
                            newWorkerCreated = true;
                        });

                        await firstWorker.kill(signal);
                    } catch (err) {
                        done(err);
                    }
                })();
            });
        });
    });

    describe("Fork", () => {
        let farm: Farm;

        function createFarm(forkOptions: ForkOptions) {
            farm = create({
                fork: forkOptions,
                module: childPath,
            });
        }

        afterEach(async () => {
            if (farm) {
                await farm.kill();
            }
        });

        it("should use cwd", async () => {
            const cwd = path.resolve(__dirname, "../examples");

            createFarm({
                cwd,
            });

            const res = await farm.runMethod("data");
            expect(res.cwd).to.equal(cwd);
        });

        it("should use env", async () => {
            const env = {
                foo: "bar",
            };

            createFarm({
                env,
            });

            const res = await farm.runMethod("data");
            expect(res.env.foo).to.equal("bar");
        });

        it("should use execPath", async () => {
            const execPath = process.execPath;

            createFarm({
                execPath,
            });

            const res = await farm.runMethod("data");
            expect(res.execPath).to.equal(execPath);
        });

        it("should use execArgv", async () => {
            const execArgv = ["--expose-gc", "--harmony"];

            createFarm({
                execArgv,
            });

            const res = await farm.runMethod("data");
            expect(res.execArgv).to.deep.equal(execArgv);
        });

        it("should use argv", async () => {
            const argv = ["0", "1"];

            const f = create({
                argv,
                module: childPath,
            });

            const res = await f.runMethod("data");
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
                createFarm({
                    silent: true, // piped to the parent through the fork
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

            it("should'nt be silent", () => {
                createFarm({
                    silent: false, // inherited from the parent
                });

                // I haven't found a way to test that stdio in parent is filled
                // Parent process stdio are empty but the console still have some data :/
                const [worker] = farm.workers;
                expect(worker.process.stdout).to.be.null;
                expect(worker.process.stderr).to.be.null;
                expect(worker.process.stdin).to.be.null;
            });

            it("should be configurable with stdio array", async () => {
                createFarm({
                    stdio: ["pipe", "inherit", process.stderr, "ipc"], // a fork must have one IPC channel
                }); // in out err

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

    describe("Errors", () => {
        [
            TypeError,
            RangeError,
            EvalError,
            ReferenceError,
            SyntaxError,
            URIError,
            Error,
        ]
            .forEach((errorType) => {
            it(`should handle a ${errorType.name} error`, async () => {
                const farm = create({
                    maxRetries: 0,
                    module: childPath,
                    numberOfWorkers: 1,
                });

                try {
                    await farm.runMethod("err", errorType.name, "1");
                } catch (err) {
                    expect(err).to.be.instanceOf(errorType);
                    expect(err.name).to.equal(errorType.name);
                    expect(err.message).to.equal("1");
                    expect(err).to.have.property("stack");
                } finally {
                    await farm.kill();
                }
            });
        });

        describe("CallMaxRetryError", () => {
           it("should expose the error which caused the worker to crash multiple times", async () => {
               const maxRetries = 2;

               const farm = create({
                   maxRetries,
                   module: childPath,
                   numberOfWorkers: 1,
               });

               try {
                   await farm.runMethod("err", "TypeError", "1");
               } catch (err) {
                   expect(err.name).to.equal("CallMaxRetryError");
                   expect(err.reason).to.be.instanceOf(TypeError);
                   expect(err.reason.name).to.equal("TypeError");
                   expect(err.reason.message).to.equal("1");
                   expect(err.reason).to.have.property("stack");
               } finally {
                   await farm.kill();
               }
           });
        });
    });
});
