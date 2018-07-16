import {expect} from "chai";
import {create, kill} from "../lib";

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
        } catch (err) {
            expect(err.name).to.equal("CallMaxRetryError");
        }
    });

    it("should respect numberOfWorkers", async () => {
        const numberOfWorkers = 2;

        const f = create({
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);
    });

    it("should respect ttl", function(done) {
        (async () => {
            try {
                const ttl = 3;

                const f = create({
                    module: childPath,
                    numberOfWorkers: 1,
                    ttl,
                });

                const [{id}] = f.workers;

                f.on("workerTTLExceeded", async (workerId) => {
                    try {
                        if (workerId === id) {
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

                for (let j = 0; j < ttl; j++) {
                    await f.run();
                }
            } catch (err) {
                done(err);
            }
        })();
    });

    it("should respect timeout", async () => {
        const timeout = 500;

        const f = create({
            module: childPath,
            numberOfWorkers: 1,
            timeout,
        });

        const startTime = process.hrtime();

        try {
            await f.runMethod("block");
            throw new Error("should have timeout");
        } catch (err) {
            expect(err.name).to.equal("TimeoutError");
        } finally {
            const endTime = process.hrtime(startTime);
            const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
            expect(diff).to.be.at.least(timeout);
        }
    });

    it("should respect maxConcurrentCallsPerWorker", async () => {
        const maxConcurrentCallsPerWorker = 2;
        const numberOfWorkers = 2;

        const f = create({
            maxConcurrentCallsPerWorker,
            module: childPath,
            numberOfWorkers,
            timeout: Infinity,
        });

        const [firstWorker, secondWorker] = f.workers;
        const overload = 2;
        const numberOfTasks = maxConcurrentCallsPerWorker * numberOfWorkers + overload;

        for (let i = 0; i < numberOfTasks; i++) {
            // we deliberately omit to wait the promise because there will never resolve for the test
            f.runMethod("block");
        }

        expect(f.queue).to.have.lengthOf(overload);
        expect(f.pendingCalls).to.have.lengthOf(numberOfTasks - overload);
        expect(firstWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
        expect(secondWorker.pendingCalls).to.equal(maxConcurrentCallsPerWorker);
    });

    it("should respect maxConcurrentCalls", async () => {
        const maxConcurrentCalls = 2;
        const numberOfWorkers = 2;

        const f = create({
            maxConcurrentCalls,
            module: childPath,
            numberOfWorkers,
            timeout: Infinity,
        });

        const [firstWorker, secondWorker] = f.workers;
        const overload = 2;
        const numberOfTasks = maxConcurrentCalls * numberOfWorkers + overload;

        for (let i = 0; i < numberOfTasks; i++) {
            // we deliberately omit to wait the promise because there will never resolve for the test
            f.runMethod("block");
        }

        expect(f.queue).to.have.lengthOf(numberOfTasks - maxConcurrentCalls);
        expect(f.pendingCalls).to.have.lengthOf(maxConcurrentCalls);
        expect(firstWorker.pendingCalls).to.equal(maxConcurrentCalls / numberOfWorkers);
        expect(secondWorker.pendingCalls).to.equal(maxConcurrentCalls / numberOfWorkers);
    });

    it("should respect kill timeout if SIGINT doesn't work", (done) => {
        (async () => {
            try {
                const killTimeout = 1000;

                const f = create({
                    killTimeout,
                    module: require.resolve("./child2"),
                    numberOfWorkers: 1,
                });

                const startTime = process.hrtime();
                const [worker] = f.workers;

                expect(await f.run()).to.equal(0); // we have to run it in order to the child to omit SIGINT

                f.once("workerExit", async (workerId) => {
                    try {
                        expect(workerId).to.equal(worker.id);
                        const endTime = process.hrtime(startTime);
                        const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                        expect(diff).to.be.at.least(killTimeout);
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

    it("shouldn't respect kill timeout if SIGINT work", (done) => {
        (async () => {
            try {
                const killTimeout = 100;

                const f = create({
                    killTimeout,
                    module: childPath,
                    numberOfWorkers: 1,
                });

                const [worker] = f.workers;
                await f.run();

                const startTime = process.hrtime();

                f.once("workerExit", async (workerId) => {
                    try {
                        expect(workerId).to.equal(worker.id);
                        const endTime = process.hrtime(startTime);
                        const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
                        expect(diff).to.be.lessThan(killTimeout);
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
