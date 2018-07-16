import {expect} from "chai";
import {create, kill} from "../lib";

const childPath = require.resolve("./child");

describe("Resilience", () => {
    after(kill);

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
                    const f = create({
                        killTimeout: 100,
                        module: childPath,
                        numberOfWorkers: 1,
                    });

                    const [firstWorker] = f.workers;
                    let newWorkerCreated = false;

                    f.once("workerKill", async (workerId) => {
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

                    f.once("newWorker", (workerId) => {
                        const [newWorker] = f.workers;
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
                    const f = create({
                        killTimeout: Infinity,
                        module: childPath,
                        numberOfWorkers: 1,
                    });

                    const [firstWorker] = f.workers;
                    let newWorkerCreated = false;

                    f.once("workerKill", async (workerId) => {
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

                    f.once("newWorker", (workerId) => {
                        const [newWorker] = f.workers;
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
