import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import Call from "../lib/Call";
import {WorkerToMasterMessage} from "../lib/types";
import JSON = require("../lib/worker/serializer/JSON");
import Worker from "../lib/worker/Worker";
import {waitForWorkerToLoad} from "./utils";

chai.use(sinonChai);
const JSONSerializerPath = require.resolve("../lib/worker/serializer/JSON");

const {expect} = chai;
const childPath = require.resolve("./child");

describe("Worker", () => {
    let worker: Worker;

    afterEach(async () => {
        if (worker) {
            await worker.kill();
        }
    });

    function createWorker(options?: any) {
        worker = new Worker(
            options && options.killTimeout || 100,
            options && options.module || childPath,
            options && options.fork || {},
            options && options.ttl || 10,
            options && options.maxConcurrentCalls || 10,
            options && options.maxIdleTime || Infinity,
            options && options.serializer || new JSON(),
            options && options.serializerPath || JSONSerializerPath,
            1,
            1,
        );
    }

    it("should be well initialised", () => {
        createWorker();
        expect(worker).to.have.property("process");
        expect(worker.process.constructor.name).to.equal("ChildProcess");
        expect(worker).to.have.property("killed").to.be.false;
        expect(worker).to.have.property("pendingCalls").to.equal(0);
    });

    it("should be killed", async () => {
        createWorker();
        await worker.kill();
        expect(worker.killed).to.be.true;
    });

    it("shouldn't be killed", () => {
        createWorker();
        expect(worker.killed).to.be.false;
    });

    it("should get proper load", () => {
        createWorker();
        worker.pendingCalls = 5;
        expect(worker.getLoad()).to.be.closeTo(0.5, 0.0001);
    });

    it("should be available", async () => {
        createWorker();
        await waitForWorkerToLoad(worker);
        expect(worker.isAvailable()).to.be.true;
    });

    it("shouldn't be available when killed", async () => {
        createWorker();
        await worker.kill();
        expect(worker.isAvailable()).to.be.false;
    });

    it("shouldn't be available is fully loaded", async () => {
        createWorker();
        worker.pendingCalls = 10;
        expect(worker.isAvailable()).to.be.false;
    });

    it("shouldn't be available is more than fully loaded", async () => {
        createWorker();
        worker.pendingCalls = 20;
        expect(worker.isAvailable()).to.be.false;
    });

    it("should be available when ttl not reached", async () => {
        createWorker();
        await waitForWorkerToLoad(worker);

        for (let i = 0; i < 9; i++) {
            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        }

        expect(worker.isAvailable()).to.be.true;
    });

    it("shouldn't be available when ttl reached", async () => {
        createWorker();
        await waitForWorkerToLoad(worker);

        for (let i = 0; i < 10; i++) {
            const res = worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));

            expect(res).to.be.true;
        }

        expect(worker.isAvailable()).to.be.false;
    });

    it("should'nt run a call when not available", () => {
        createWorker();
        sinon.stub(worker, "isAvailable").returns(false);

        const res = worker.run(new Call({
            args: [],
            timeout: Infinity,
        }, () => true, () => false));

        try {
            expect(res).to.be.false;
        } catch (err) {
            throw err;
        } finally {
            (worker.isAvailable as sinon.SinonStub).restore();
        }
    });

    describe("Events", () => {
        it("emit message", (done) => {
            createWorker();
            worker.once("message", () => {
                done();
            });

            (async () => {
                await waitForWorkerToLoad(worker);

                worker.run(new Call({
                    args: [],
                    timeout: Infinity,
                }, () => true, () => false));
            })();
        });

        it("emit TTLExceeded", (done) => {
            createWorker({
                ttl: 1,
            });

            worker.once("TTLExceeded", () => {
                done();
            });

            (async () => {
                await waitForWorkerToLoad(worker);

                worker.run(new Call({
                    args: [],
                    timeout: Infinity,
                }, () => true, () => false));
            })();
        });

        it("emit exit", (done) => {
            createWorker();

            worker.once("exit", () => {
                done();
            });

            worker.kill();
        });

        it("emit killed after exit", (done) => {
            createWorker();

            let exited = false;

            worker.once("exit", () => {
                exited = true;
            });

            worker.once("killed", () => {
                expect(exited).to.be.true;
                done();
            });

            worker.kill();
        });

        it("emit killed", (done) => {
            createWorker();

            worker.once("killed", () => {
                done();
            });

            worker.kill();
        });

        it("shouldn't emit killed without calling kill", (done) => {
            createWorker();

            let killed = false;

            worker.once("killed", () => {
                killed = true;
            });

            worker.once("exit", () => {
                expect(killed).to.be.false;
                done();
            });

            worker.process.emit("exit");
        });

        it("emit close", (done) => {
            createWorker();

            worker.once("close", () => {
                done();
            });

            worker.kill();
        });

        it("emit disconnect", (done) => {
            createWorker();

            worker.once("disconnect", () => {
                done();
            });

            worker.kill();
        });

        it("emit error", (done) => {
            createWorker();

            const err = new Error("boom");

            worker.once("error", (error) => {
                expect(error).to.deep.equal(err);
                done();
            });

            worker.process.emit("error", err);
        });

        it("emit moduleLoaded", (done) => {
            createWorker();

            worker.once("moduleLoaded", () => {
                 done();
            });
        });

        it("emit maxIdleTime", (done) => {
            createWorker({
                maxIdleTime: 200,
            });

            worker.once("maxIdleTime", () => {
                done();
            });

            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        });
    });

    it("should be killed when silent", async () =>  {
        createWorker({
            fork: {
                silent: true,
            },
        });

        await worker.kill();

        expect(worker.killed).to.be.true;
    });

    it("should be killed when stdio ignored", async () =>  {
        createWorker({
            fork: {
                stdio: ["ignore", "ignore", "ignore", "ignore"],
            },
        });

        await worker.kill();

        expect(worker.killed).to.be.true;
    });

    it("should be killed when stdio is piped", async () =>  {
        createWorker({
            fork: {
                stdio: ["pipe", "pipe", "pipe", "pipe"],
            },
        });

        await worker.kill();

        expect(worker.killed).to.be.true;
    });

    it("should warn when the module is not defined", (done) => {
        worker = new Worker(100, "123123", {}, 10, 10, Infinity, new JSON(), JSONSerializerPath, 1, 1);

        sinon.stub(console, "error");

        setTimeout(() => {
            try {
                expect(console.error).to.have.been.calledOnce;
                expect(console.error).to.have.been.calledWith("Workhorse : Error while loading your module.");
                done();
            } catch (err) {
                done(err);
            } finally {
                (console.error as sinon.SinonStub).restore();
            }
        }, 1000);
    });

    it("should send an error when method is undefined in module", (done) => {
        createWorker();

        (async () => {
            await waitForWorkerToLoad(worker);

            worker.once("message", (data: WorkerToMasterMessage) => {
                expect(data).to.have.property("err");
                expect(data).to.have.property("callId");
                expect((data.err as any).name).to.equal("Error");
                expect((data.err as any).message).to.equal("method \"undefinedMethod\" is not defined in module");
                done();
            });

            worker.run(new Call({
                args: [],
                method: "undefinedMethod",
                timeout: Infinity,
            }, () => true, () => false));
        })();
    });

    it("should throw an error when trying to run a method when the module is still not loaded with unknown module",
        (done) => {
            createWorker({
                module: "123",
            });
            sinon.stub(worker, "isAvailable").returns(true);
            sinon.stub(console, "error");
            // do not wait for the worker to be ready

            worker.process.once("message", (data: WorkerToMasterMessage) => {
                expect(data.err!.message).to.equal("Cannot find module '123'");

                worker.process.once("message", (data2: WorkerToMasterMessage) => {
                    expect(data2.err!.message).to.equal("The worker module is still not loaded, it can\'t be used.");

                    setTimeout(() => { // We have to put a timeout because we get the message before the worker
                        try {
                            expect(console.error).to.have.been.calledTwice;

                            expect(
                                (console.error as sinon.SinonStub).args[0][0],
                                "Workhorse : Error while loading your module.",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[0][1].message,
                                "Cannot find module '123'",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[1][0],
                                "Workhorse : Error while loading your module.",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[1][1].message,
                                "The worker module is still not loaded, it can\'t be used.",
                            );

                            done();
                        } catch (err) {
                            done(err);
                        } finally {
                            ((worker as any).isAvailable as sinon.SinonStub).restore();
                            (console.error as sinon.SinonStub).restore();
                        }
                    }, 50);
                });
            });

            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
    });

    it("should throw an error when trying to run a method when the serializer is still not loaded",
        (done) => {
            createWorker({
                serializer: new JSON(),
                serializerPath: "123",
            });

            sinon.stub(worker, "isAvailable").returns(true);
            sinon.stub(console, "error");
            // do not wait for the worker to be ready

            worker.process.once("message", (data: WorkerToMasterMessage) => {
                expect(data.err!.message).to.equal("Cannot find module '123'");

                worker.process.once("message", (data2: WorkerToMasterMessage) => {
                    expect(data2.err!.message).to.equal("The worker module is still not loaded, it can\'t be used.");

                    setTimeout(() => { // We have to put a timeout because we get the message before the worker
                        try {
                            expect(console.error).to.have.been.calledTwice;

                            expect(
                                (console.error as sinon.SinonStub).args[0][0],
                                "Workhorse : Error while loading your module.",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[0][1].message,
                                "Cannot find module '123'",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[1][0],
                                "Workhorse : Error while loading your module.",
                            );

                            expect(
                                (console.error as sinon.SinonStub).args[1][1].message,
                                "The worker module is still not loaded, it can\'t be used.",
                            );

                            done();
                        } catch (err) {
                            done(err);
                        } finally {
                            ((worker as any).isAvailable as sinon.SinonStub).restore();
                            (console.error as sinon.SinonStub).restore();
                        }
                    }, 50);
                });
            });

            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        });
});
