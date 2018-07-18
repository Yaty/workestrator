import {expect} from "chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

const childPath = require.resolve("./child");

describe("Resilience", () => {
    after(kill);

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

    it("should restart a new worker after a TTL", (done) => {
        (async () => {
            try {
                const ttl = 1;

                const f = create({
                    module: childPath,
                    numberOfWorkers: 1,
                    ttl,
                });

                const [firstWorker] = f.workers;

                f.on("newWorker", async (workerId) => {
                    try {
                        const [newWorker] = f.workers;
                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.exited).to.be.true;
                        expect(firstWorker.id).to.not.equal(workerId);
                        expect(workerId).to.equal(newWorker.id);
                        done();
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

    it("should restart a new worker after a timeout", (done) => {
        (async () => {
            try {
                const timeout = 500;

                const f = create({
                    module: childPath,
                    numberOfWorkers: 1,
                    timeout,
                });

                const [firstWorker] = f.workers;

                f.on("newWorker", async (workerId) => {
                    try {
                        const [newWorker] = f.workers;
                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.exited).to.be.true;
                        expect(firstWorker.id).to.not.equal(workerId);
                        expect(workerId).to.equal(newWorker.id);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                try {
                    await f.runMethod("block");
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
                    const [firstWorker] = farm.workers;
                    let newWorkerCreated = false;

                    farm.once("workerKill", async (workerId: number) => {
                        try {
                            expect(newWorkerCreated).to.be.true;
                            expect(workerId).to.equal(firstWorker.id);
                            expect(firstWorker.killed).to.be.true;
                            expect(firstWorker.exited).to.be.true;
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

                    farm2.once("workerKill", async (workerId: number) => {
                        try {
                            expect(newWorkerCreated).to.be.true;
                            expect(workerId).to.equal(firstWorker.id);
                            expect(firstWorker.killed).to.be.true;
                            expect(firstWorker.exited).to.be.true;
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

    it("should redistribute tasks to other workers when killed", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 2,
        });

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
        expect(firstWorker.exited).to.be.true;
        expect(secondWorker.id).to.not.equal(thirdWorker.id);
        expect(firstWorker.pendingCalls).to.equal(0);
        expect(secondWorker.pendingCalls).to.equal(1);
        expect(thirdWorker.pendingCalls).to.equal(1);
    });

    it("should redistribute tasks to the new worker when killed if we only have one worker", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        const [firstWorker] = f.workers;

        for (let i = 0; i < 2; i++) {
            // we omit the promise deliberately
            f.runMethod("block");
        }

        expect(firstWorker.pendingCalls).to.equal(2);

        await firstWorker.kill();
        const [secondWorker] = f.workers;

        expect(firstWorker.killed).to.be.true;
        expect(firstWorker.exited).to.be.true;
        expect(firstWorker.id).to.not.equal(secondWorker.id);
        expect(firstWorker.pendingCalls).to.equal(0);
        expect(secondWorker.pendingCalls).to.equal(2);
    });
});
