import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";
import {waitForWorkersToLoad, waitForWorkerToLoad} from "./utils";

const {assert, expect} = chai;
chai.use(sinonChai);

const childPath = require.resolve("./child");

describe("Resilience", () => {
    after(kill);

    it("should restart a new worker after a TTL", (done) => {
        const ttl = 1;

        const f = create({
            module: childPath,
            numberOfWorkers: 1,
            ttl,
        });

        const [firstWorker] = f.workers;

        let newWorkerCreated = false;
        let workerKilled = false;
        let workerTTLExceeded = false;

        function check() {
            if (newWorkerCreated && workerKilled && workerTTLExceeded) {
                done();
            }
        }

        f.once("workerTTLExceeded", (workerId) => {
            expect(workerId).to.equal(firstWorker.id);
            workerTTLExceeded = true;
            check();
        });

        f.once("workerKilled", (workerId) => {
            expect(workerId).to.equal(firstWorker.id);
            workerKilled = true;
            check();
        });

        f.once("newWorker", (workerId) => {
            const [newWorker] = f.workers;
            expect(firstWorker.id).to.not.equal(workerId);
            expect(workerId).to.equal(newWorker.id);
            newWorkerCreated = true;
            check();
        });

        for (let j = 0; j < ttl; j++) {
            f.run();
        }
    });

    it("should restart a new worker after a timeout", (done) => {
        const timeout = 500;

        const f = create({
            module: childPath,
            numberOfWorkers: 1,
            timeout,
        });

        const [firstWorker] = f.workers;

        let newWorkerCreated = false;
        let workerKilled = false;
        let timeoutReceived = false;

        function check() {
            if (newWorkerCreated && workerKilled && timeoutReceived) {
                done();
            }
        }

        f.once("workerKilled", (workerId) => {
            expect(workerId).to.equal(firstWorker.id);
            workerKilled = true;
            check();
        });

        f.once("newWorker", (workerId) => {
            const [newWorker] = f.workers;
            expect(firstWorker.id).to.not.equal(workerId);
            expect(workerId).to.equal(newWorker.id);
            newWorkerCreated = true;
            check();
        });

        try {
            (async () => {
                try {
                    await f.runMethod("block");
                    assert.fail("should throw");
                } catch (err) {
                    expect(err.constructor.name).to.equal("TimeoutError");
                    timeoutReceived = true;
                    check();
                }
            })();
        } catch (err) {
            done(err);
        }
    });

    describe("Signals", () => {
        let farm: Farm;
        let farm2: Farm;

        before(() => {
            farm = create({
                killTimeout: 100,
                module: childPath,
                numberOfWorkers: 1,
            });

            farm2 = create({
                killTimeout: Infinity,
                module: childPath,
                numberOfWorkers: 1,
            });
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
                        const [firstWorker] = farm.workers;
                        let newWorkerCreated = false;

                        farm.once("workerKilled", async (workerId: number) => {
                            try {
                                expect(newWorkerCreated).to.be.true;
                                expect(workerId).to.equal(firstWorker.id);
                                expect(firstWorker.killed).to.be.true;
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });

                        farm.once("newWorker", (workerId: number) => {
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
                        const [firstWorker] = farm2.workers;
                        let newWorkerCreated = false;

                        farm2.once("workerKilled", async (workerId: number) => {
                            try {
                                expect(newWorkerCreated).to.be.true;
                                expect(workerId).to.equal(firstWorker.id);
                                expect(firstWorker.killed).to.be.true;
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });

                        farm2.once("newWorker", (workerId: number) => {
                            const [newWorker] = farm2.workers;
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

    it("should redistribute tasks to other workers when killed", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 2,
        });

        await waitForWorkersToLoad(f);

        const firstWorker = f.workers[0];
        const secondWorker = f.workers[1];

        for (let i = 0; i < 2; i++) {
            // we omit the promise deliberately
            f.runMethod("block");
        }

        expect(firstWorker.pendingCalls).to.equal(1);
        expect(secondWorker.pendingCalls).to.equal(1);

        await firstWorker.kill();
        const thirdWorker = f.workers[1];

        expect(firstWorker.killed).to.be.true;
        expect(firstWorker.id).to.not.equal(thirdWorker.id);
        expect(secondWorker.id).to.not.equal(thirdWorker.id);
        expect(firstWorker.pendingCalls).to.equal(0);
        expect(secondWorker.pendingCalls).to.equal(2);
        expect(thirdWorker.pendingCalls).to.equal(0);

        await waitForWorkerToLoad(thirdWorker);

        f.runMethod("block");
        expect(firstWorker.pendingCalls).to.equal(0);
        expect(secondWorker.pendingCalls).to.equal(2);
        expect(thirdWorker.pendingCalls).to.equal(1);
    });

    it("should redistribute tasks to the new worker when killed if we only have one worker", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        await waitForWorkersToLoad(f);

        const [firstWorker] = f.workers;

        for (let i = 0; i < 2; i++) {
            // we omit the promise deliberately
            f.runMethod("block");
        }

        expect(firstWorker.pendingCalls).to.equal(2);

        await firstWorker.kill();
        const [secondWorker] = f.workers;

        expect(firstWorker.killed).to.be.true;
        expect(firstWorker.id).to.not.equal(secondWorker.id);
        expect(firstWorker.pendingCalls).to.equal(0);

        await waitForWorkersToLoad(f);
        expect(secondWorker.pendingCalls).to.equal(2);
    });

    it("should recreate a worker if he disappeared during a timed out", (done) => {
        const f = create({
            maxRetries: 0,
            module: childPath,
            numberOfWorkers: 1,
            timeout: 10,
        });

        const [firstWorker] = f.workers;

        (async () => {
            await waitForWorkersToLoad(f);

            f.runMethod("failTimeout")
                .then(() => {
                    assert.fail("should throw");
                })
                .catch((err) => {
                    try {
                        expect(err.constructor.name).to.equal("TimeoutError");
                        expect(f.workers).to.have.lengthOf(1);
                        expect(f.workers[0].id).to.not.equal(firstWorker.id);
                        expect(firstWorker.killed).to.be.false;
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

            // While running we remove the worker: )
            f.workers = [];
        })();
    });

    it("should requeue call if the worker can't run it when processing queue", () => {
        // This should not happen in real use because the worker availability is checked just before

        const f = create({
            maxRetries: 0,
            module: childPath,
            numberOfWorkers: 1,
            timeout: 10,
        });

        const [worker] = f.workers;

        const isAvailableStub = sinon.stub(worker, "isAvailable");
        isAvailableStub.onFirstCall().returns(true);
        isAvailableStub.onSecondCall().returns(false);

        const queuePushSpy = sinon.spy(f.queue, "push");
        const queueShiftSpy = sinon.spy(f.queue, "shift");
        const queueUnshiftSpy = sinon.spy(f.queue, "unshift");

        f.run();

        expect(queuePushSpy).to.have.been.calledOnce; // Add in queue at run
        expect(queueShiftSpy).to.have.been.calledOnce; // Try to process
        expect(queueUnshiftSpy).to.have.been.calledOnce; // Reput in queue
    });
});
