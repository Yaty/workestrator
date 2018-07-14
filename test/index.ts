import {AssertionError} from "assert";
import {expect} from "chai";
import {ForkOptions} from "child_process";
import "mocha";
import path from "path";
import Farm from "../lib/Farm";
import workhorse from "../lib/index";

const childPath = require.resolve("./child");

describe("Workhorse", () => {
    describe("Instantiation", () => {
        /*
            TODO : Check parameters
                maxConcurrentCalls: number;
                maxConcurrentCallsPerWorker: number;
                maxRetries: number;
                numberOfWorkers: number;
                ttl: number;
                timeout: number;
                killTimeout: number;
                fork: ForkOptions;
                module: string;
         */
    });

    describe("Validation", () => {
       /*
       TODO : Validation
        */

        const ttls = [-1, 0, [], {}, "", new Function()];

        for (const ttl of ttls) {
            it(`shouldn't allow ttl : ${ttl}`, () => {
                expect(() => workhorse({
                    module: childPath,
                    ttl: ttl as any,
                })).to.throw(AssertionError);
            });
        }
    });

    describe("Functions", () => {
        let farm: Farm;

        beforeEach(() => {
            farm = workhorse({
                module: childPath,
            });
        });

        afterEach(async () => {
            await farm.kill();
        });

        it("exports = function", async function() {
            const {pid, rnd}  = await farm.run(0);

            expect(pid).to.be.greaterThan(process.pid);
            expect(pid).to.be.lessThan(process.pid + 750);
            expect(rnd).to.within(0, 1);
        });

        it("exports = function with args", async function() {
            const {args}  = await farm.run(0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });

        it("exports.fn = function", async function() {
            const {pid, rnd}  = await farm.runMethod("run0");

            expect(pid).to.be.greaterThan(process.pid);
            expect(pid).to.be.lessThan(process.pid + 750);
            expect(rnd).to.within(0, 1);
        });

        it("exports.fn = function with args", async function() {
            const {args} = await farm.runMethod("data", 0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });
    });

    describe("Constraints", () => {
        it("should respect ttl", function(done) {
            (async () => {
                try {
                    const ttl = 3;

                    const farm = workhorse({
                        module: childPath,
                        numberOfWorkers: 1,
                        ttl,
                    });

                    const [{id}] = farm.workers;

                    farm.on("workerTTLExceeded", async (workerId) => {
                        if (workerId === id) {
                            await farm.kill();
                            done();
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

            const farm = workhorse({
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
            }
        });
    });

    describe("Performance", () => {
        // it("finds pi quickly", () => {});
    });

    describe("Resilience", () => {
        it("should restart a new worker after a TTL", (done) => {
            (async () => {
                try {
                    const ttl = 1;

                    const farm = workhorse({
                        module: childPath,
                        numberOfWorkers: 1,
                        ttl,
                    });

                    const [firstWorker] = farm.workers;

                    farm.on("newWorker", async (workerId) => {
                        const [newWorker] = farm.workers;
                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.exited).to.be.true;
                        expect(firstWorker.id).to.not.equal(workerId);
                        expect(workerId).to.equal(newWorker.id);
                        await farm.kill();
                        done();
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

                    const farm = workhorse({
                        module: childPath,
                        numberOfWorkers: 1,
                        timeout,
                    });

                    const [firstWorker] = farm.workers;

                    farm.on("newWorker", async (workerId) => {
                        const [newWorker] = farm.workers;
                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.exited).to.be.true;
                        expect(firstWorker.id).to.not.equal(workerId);
                        expect(workerId).to.equal(newWorker.id);
                        await farm.kill();
                        done();
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
    });

    describe("Fork", () => {
        let farm: Farm;

        function createFarm(forkOptions: ForkOptions) {
            farm = workhorse({
                fork: forkOptions,
                module: childPath,
            });
        }

        afterEach(async () => {
            if (farm) {
                await farm.kill();
            }
        });
        /*
        silent <boolean> If true, stdin, stdout, and stderr of the child will be piped to the parent,
        otherwise they will be inherited from the parent, see the 'pipe' and 'inherit' options
        for child_process.spawn()'s stdio for more details. Default: false

        stdio <Array> | <string> See child_process.spawn()'s stdio. When this option is provided,
        it overrides silent. If the array variant is used, it must contain exactly one item with
        value 'ipc' or an error will be thrown. For instance [0, 1, 2, 'ipc'].
        windowsVerbatimArguments <boolean> No quoting or escaping of arguments is done on Windows.
        Ignored on Unix. Default: false.

        uid <number> Sets the user identity of the process (see setuid(2)).
        gid <number> Sets the group identity of the process (see setgid(2)).
         */
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

            const COVERAGE_KEYS = [
                "BABEL_DISABLE_CACHE",
                "PATH",
                "SPAWN_WRAP_SHIM_ROOT",
            ];

            for (const key of Object.keys(res.env)) {
                if (key.startsWith("NYC") || COVERAGE_KEYS.includes(key) || key.startsWith("SW_ORIG")) {
                    delete res.env[key];
                }
            }

            expect(res.env).to.deep.equal(env);
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

            const f = workhorse({
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
    });
});
