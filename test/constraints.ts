import {assert, expect} from "chai";
import {create, kill} from "../lib";
import MaxConcurrentCallsError from "../lib/MaxConcurrentCallsError";
import Timer = NodeJS.Timer;

const childPath = require.resolve("./child");

describe("Constraints", () => {
    after(kill);

    it("should respect maxRetries", async () => {
        const maxRetries = 2;

        const f = create({
            maxRetries,
            module: childPath,
            numberOfWorkers: 1,
        });

        try {
            await f.runMethod("err");
            assert.fail("should throw");
        } catch (err) {
            expect(err.name).to.equal("CallMaxRetryError");
        }
    });

    it("should respect numberOfWorkers", () => {
        const numberOfWorkers = 2;

        const f = create({
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);
    });

    it("should respect ttl", function(done) {
        const ttl = 3;

        const f = create({
            module: childPath,
            numberOfWorkers: 1,
            ttl,
        });

        f.once("online", () => {
            const [{id}] = f.workers;

            f.on("ttl", (w) => {
                try {
                    if (w.id === id) {
                        done();
                    }
                } catch (err) {
                    done(err);
                }
            });

            for (let j = 0; j < ttl; j++) {
                f.run();
            }
        });
    });

    it("should respect timeout", async () => {
        const timeout = 500;

        const f = create({
            maxRetries: 0,
            module: childPath,
            numberOfWorkers: 1,
            timeout,
        });

        const startTime = process.hrtime();

        try {
            await f.runMethod("block");
            assert.fail("should have timeout");
        } catch (err) {
            expect(err.name).to.equal("TimeoutError");
        } finally {
            const endTime = process.hrtime(startTime);
            const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
            expect(diff).to.be.at.least(timeout);
        }
    });

    it("should respect maxConcurrentCallsPerWorker", (done) => {
        const maxConcurrentCallsPerWorker = 2;
        const numberOfWorkers = 2;

        const f = create({
            maxConcurrentCallsPerWorker,
            module: childPath,
            numberOfWorkers,
            timeout: Infinity,
        });

        let firstWorkerReady = false;
        let secondWorkerReady = false;

        f.workers[0].once("online", () => {
            firstWorkerReady = true;
            check();
        });

        f.workers[1].once("online", () => {
            secondWorkerReady = true;
            check();
        });

        function check() {
            if (!firstWorkerReady || ! secondWorkerReady) {
                return;
            }

            const [firstWorker, secondWorker] = f.workers;
            const overload = 2;
            const numberOfTasks = maxConcurrentCallsPerWorker * numberOfWorkers + overload;

            for (let i = 0; i < numberOfTasks; i++) {
                // we deliberately omit to wait the promise because there will never resolve for the test
                f.runMethod("block");
            }

            try {
                expect(f.queue).to.have.lengthOf(overload);
                expect(f.pendingCalls).to.have.lengthOf(numberOfTasks - overload);
                expect(firstWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
                expect(secondWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
                done();
            } catch (err) {
                done(err);
            }
        }
    });

    it("should respect maxConcurrentCalls when pendingCalls is full", (done) => {
        const maxConcurrentCalls = 2;
        const numberOfWorkers = 1;

        const f = create({
            maxConcurrentCalls,
            module: childPath,
            numberOfWorkers,
            timeout: Infinity,
        });

        const [worker] = f.workers;
        const overload = 2;

        for (let i = 0; i < maxConcurrentCalls; i++) {
            f.runMethod("block");
        }

        f.once("online", async () => {
            try {
                for (let i = 0; i < overload; i++) {
                    try {
                        await f.run();
                        assert.fail("should throw");
                    } catch (err) {
                        expect(err).to.be.instanceOf(MaxConcurrentCallsError);
                        expect(err.name).to.equal("MaxConcurrentCallsError");
                    }
                }

                expect(f.queue).to.have.lengthOf(0);
                expect(f.pendingCalls).to.have.lengthOf(maxConcurrentCalls);
                expect(worker.pendingCalls).to.equal(maxConcurrentCalls);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it("should respect maxConcurrentCalls when pendingCalls is full " +
        "and maxConcurrentCallsPerWorker is 1", (done) => {
        const maxConcurrentCalls = 2;
        const numberOfWorkers = 1;
        const maxConcurrentCallsPerWorker = 1;

        const f = create({
            maxConcurrentCalls,
            maxConcurrentCallsPerWorker,
            module: childPath,
            numberOfWorkers,
            timeout: Infinity,
        });

        const [worker] = f.workers;
        const overload = 2;

        for (let i = 0; i < maxConcurrentCalls; i++) {
            f.runMethod("block");
        }

        f.once("online", async () => {
            try {
                for (let i = 0; i < overload; i++) {
                    try {
                        await f.run();
                        assert.fail("should throw");
                    } catch (err) {
                        expect(err).to.be.instanceOf(MaxConcurrentCallsError);
                        expect(err.name).to.equal("MaxConcurrentCallsError");
                    }
                }

                expect(f.queue).to.have.lengthOf(1);
                expect(f.pendingCalls).to.have.lengthOf(maxConcurrentCallsPerWorker);
                expect(worker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it("should respect kill timeout if SIGINT doesn't work", (done) => {
        (async () => {
            try {
                const killTimeout = 500;

                const f = create({
                    killTimeout,
                    module: require.resolve("./child2"),
                    numberOfWorkers: 1,
                });

                const startTime = process.hrtime();
                const [worker] = f.workers;

                expect(await f.run()).to.equal(0); // we have to run it in order to the child to omit SIGINT

                f.once("exit", (w, code, signal) => {
                    try {
                        expect(w.id).to.equal(worker.id);
                        expect(code).to.be.null;
                        expect(signal).to.equal(process.platform === "win32" ? "SIGINT" : "SIGKILL");
                        const endTime = process.hrtime(startTime);
                        const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                        expect(diff).to.be.at.least(killTimeout);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                worker.kill();
            } catch (err) {
                done(err);
            }
        })();
    });

    it("shouldn't respect kill timeout if SIGINT work", (done) => {
        (async () => {
            try {
                const killTimeout = 500;

                const f = create({
                    killTimeout,
                    module: childPath,
                    numberOfWorkers: 1,
                });

                const [worker] = f.workers;
                await f.run();

                const startTime = process.hrtime();

                f.once("exit", (w, code, signal) => {
                    try {
                        expect(w.id).to.equal(worker.id);
                        expect(code).to.be.null;
                        expect(signal).to.equal("SIGINT");
                        const endTime = process.hrtime(startTime);
                        const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                        expect(diff).to.be.lessThan(killTimeout);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                worker.kill();
            } catch (err) {
                done(err);
            }
        })();
    });

    it("should respect maxIdleTime", (done) => {
        const maxIdleTime = 200;

        const f = create({
            maxIdleTime,
            module: childPath,
            numberOfWorkers: 1,
        });

        const [worker] = f.workers;
        let start: [number, number];

        f.run()
            .then(() => {
                start = process.hrtime();
            });

        f.on("idle", (w) => {
            try {
                expect(w.id).to.equal(worker.id);
                const end = process.hrtime(start);
                const diff = (end[0] * 1000) + (end[1] / 1000000);
                expect(diff).to.be.greaterThan(maxIdleTime - 5); // - 5 is just a margin
                done();
            } catch (err) {
                done(err);
            }
        });

    });

    it("should reset idleTimer", (done) => {
        const maxIdleTime = 200;

        const f = create({
            maxIdleTime,
            module: childPath,
            numberOfWorkers: 1,
        });

        let eventCalled = false;

        f.once("idle", () => {
            eventCalled = true;
        });

        const timer = (f.workers[0] as any).idleTimer;
        let secondTimer: Timer;

        f.run()
            .then(() => {
                return f.run();
            })
            .then(() => {
                secondTimer = (f.workers[0] as any).idleTimer;
                return f.run();
            })
            .then(() => {
                const thirdTimer = (f.workers[0] as any).idleTimer;
                expect(timer).to.be.undefined;
                expect(eventCalled).to.be.false;
                expect(secondTimer).to.not.equal(thirdTimer);
                done();
            })
            .catch((err) => {
                done(err);
            });
    });
});
