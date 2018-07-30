import * as chai from "chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

const {assert, expect} = chai;

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

        f.once("ttl", (w) => {
            expect(w.id).to.equal(firstWorker.id);
            workerTTLExceeded = true;
            check();
        });

        f.once("exit", (w) => {
            expect(w.id).to.equal(firstWorker.id);
            workerKilled = true;
            check();
        });

        f.once("fork", (w) => {
            const [newWorker] = f.workers;
            expect(firstWorker.id).to.not.equal(w.id);
            expect(w.id).to.equal(newWorker.id);
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
            maxRetries: 0,
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

        f.once("exit", (w) => {
            expect(w.id).to.equal(firstWorker.id);
            workerKilled = true;
            check();
        });

        f.once("fork", (w) => {
            const [newWorker] = f.workers;
            expect(firstWorker.id).to.not.equal(w.id);
            expect(w.id).to.equal(newWorker.id);
            newWorkerCreated = true;
            check();
        });

        f.runMethod("block")
            .then(() => {
                assert.fail("should throw");
            })
            .catch((err) => {
                try {
                    expect(err.constructor.name).to.equal("TimeoutError");
                    timeoutReceived = true;
                } catch (err) {
                    return done(err);
                }

                check();
            });
    });

    describe("Signals", () => {
        let farm: Farm;
        let farm2: Farm;

        before(async () => {
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

        const signals = process.platform === "win32" ? [
            "SIGINT", "SIGKILL", "SIGTERM",
        ] : [
            "SIGHUP", "SIGINT", "SIGQUIT",
            "SIGABRT", "SIGKILL", "SIGTERM",
        ];

        // when using a timeout it will kill the worker no matter what the signal is once timed out
        signals.forEach((signal) => {
            it(`should restart a worker on ${signal} when using kill method with timeout`, (done) => {
                const [firstWorker] = farm.workers;
                let newWorkerCreated = false;
                let workerKilled = false;

                function check() {
                    if (newWorkerCreated && workerKilled) {
                        done();
                    }
                }

                farm.once("exit", (w) => {
                    try {
                        expect(w.id).to.equal(firstWorker.id);
                        expect(firstWorker.killed).to.be.true;
                        workerKilled = true;
                        check();
                    } catch (err) {
                        done(err);
                    }
                });

                farm.once("fork", (w) => {
                    try  {
                        const [newWorker] = farm.workers;
                        expect(firstWorker.id).to.not.equal(w.id);
                        expect(w.id).to.equal(newWorker.id);
                        newWorkerCreated = true;
                        check();
                    } catch (err) {
                        done(err);
                    }
                });

                firstWorker.kill(signal);
            });
        });

        signals.forEach((signal) => {
            it(`should restart a worker on ${signal} when using kill method without timeout`, (done) => {
                const [firstWorker] = farm2.workers;
                let newWorkerCreated = false;
                let workerKilled = false;

                function check() {
                    if (newWorkerCreated && workerKilled) {
                        done();
                    }
                }

                farm2.once("exit", (w) => {
                    try {
                        expect(w.id).to.equal(firstWorker.id);
                        expect(firstWorker.killed).to.be.true;
                        workerKilled = true;
                        check();
                    } catch (err) {
                        done(err);
                    }
                });

                farm2.once("fork", (w) => {
                    try {
                        const [newWorker] = farm2.workers;
                        expect(firstWorker.id).to.not.equal(w.id);
                        expect(w.id).to.equal(newWorker.id);
                        newWorkerCreated = true;
                        check();
                    } catch (err) {
                        done(err);
                    }
                });

                firstWorker.kill(signal);
            });
        });
    });

    it("should redistribute tasks to other workers when killed", (done) => {
        const f = create({
            module: childPath,
            numberOfWorkers: 2,
        });

        const firstWorker = f.workers[0];
        const secondWorker = f.workers[1];

        let firstWorkerReady = false;
        let secondWorkerReady = false;

        firstWorker.once("online", () => {
            firstWorkerReady = true;
            check();
        });

        secondWorker.once("online", () => {
            secondWorkerReady = true;
            check();
        });

        function check() {
            if (!firstWorkerReady || !secondWorkerReady) {
                return;
            }

            for (let i = 0; i < 2; i++) {
                f.runMethod("block");
            }

            try {
                expect(firstWorker.pendingCalls).to.equal(1);
                expect(secondWorker.pendingCalls).to.equal(1);

                firstWorker.kill();

                f.once("exit", () => {
                    try {
                        const thirdWorker = f.workers[1];

                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.id).to.not.equal(thirdWorker.id);
                        expect(secondWorker.id).to.not.equal(thirdWorker.id);

                        expect(firstWorker.pendingCalls).to.equal(0);
                        expect(secondWorker.pendingCalls).to.equal(2);
                        expect(thirdWorker.pendingCalls).to.equal(0);

                        thirdWorker.once("online", () => {
                            try {
                                f.runMethod("block");
                                expect(firstWorker.pendingCalls).to.equal(0);
                                expect(secondWorker.pendingCalls).to.equal(2);
                                expect(thirdWorker.pendingCalls).to.equal(1);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });
                    } catch (err) {
                        done(err);
                    }
                });
            } catch (err) {
                done(err);
            }
        }
    });

    it("should redistribute tasks to the new worker when killed if we only have one worker", (done) => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        const [firstWorker] = f.workers;

        for (let i = 0; i < 2; i++) {
            // we omit the promise deliberately
            f.runMethod("block");
        }

        firstWorker.on("online", () => {
            try {
                expect(firstWorker.pendingCalls).to.equal(2);

                firstWorker.kill();

                f.once("exit", () => {
                    try {
                        const [secondWorker] = f.workers;

                        expect(firstWorker.killed).to.be.true;
                        expect(firstWorker.id).to.not.equal(secondWorker.id);
                        expect(firstWorker.pendingCalls).to.equal(0);

                        secondWorker.on("online", () => {
                            try {
                                expect(secondWorker.pendingCalls).to.equal(2);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });
                    } catch (err) {
                        done(err);
                    }
                });
            } catch (err) {
                done(err);
            }
        });
    });

    it("should recreate a worker if he disappeared during a timed out", (done) => {
        const f = create({
            maxRetries: 0,
            module: childPath,
            numberOfWorkers: 1,
            timeout: 10,
        });

        const [firstWorker] = f.workers;

        firstWorker.once("online", () => {
            f.runMethod("failTimeout")
                .then(() => {
                    assert.fail("should throw");
                })
                .catch((err) => {
                    f.on("fork", () => {
                        try {
                            expect(err.constructor.name).to.equal("TimeoutError");
                            expect(f.workers).to.have.lengthOf(1);
                            expect(f.workers[0].id).to.not.equal(firstWorker.id);
                            expect(firstWorker.killed).to.be.true;
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
                });

            // While running we remove the workers :)
            f.workers = [];
        });
    });

    it("should recreate a worker after maxIdleTime", (done) => {
        const maxIdleTime = 200;

        const f = create({
            maxIdleTime,
            module: childPath,
            numberOfWorkers: 1,
        });

        const [worker] = f.workers;

        f.run()
            .then(() => {
                f.on("idle", (w) => {
                    try {
                        expect(w.id).to.equal(worker.id);

                        f.on("fork", (w) => {
                            try {
                                const [newWorker] = f.workers;
                                expect(newWorker.id).to.not.equal(worker.id);
                                expect(newWorker.id).to.equal(w.id);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        });
                    } catch (err) {
                        done(err);
                    }
                });
            })
            .catch((err) => {
                done(err);
            });
    });
});
