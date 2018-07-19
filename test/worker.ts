import chai, {expect} from "chai";
import sinon, {SinonStub} from "sinon";
import sinonChai from "sinon-chai";
import Call from "../lib/Call";
import Worker from "../lib/worker/Worker";

chai.use(sinonChai);

const childPath = require.resolve("./child");

describe("Worker", () => {
    let worker: Worker | null;

    afterEach(async () => {
        if (worker) {
            await worker.kill();
        }

        worker = null;
    });

    it("should be well initialised", () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        expect(worker).to.have.property("process");
        expect(worker.process.constructor.name).to.equal("ChildProcess");
        expect(worker).to.have.property("killed").to.be.false;
        expect(worker).to.have.property("pendingCalls").to.equal(0);
    });

    it("should be killed", async () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        await worker.kill();
        expect(worker.killed).to.be.true;
    });

    it("shouldn't be killed", () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        expect(worker.killed).to.be.false;
    });

    it("should get proper load", () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        worker.pendingCalls = 5;
        expect(worker.getLoad()).to.be.closeTo(0.5, 0.0001);
    });

    it("should be available", () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        expect(worker.isAvailable()).to.be.true;
    });

    it("shouldn't be available when killed", async () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        await worker.kill();
        expect(worker.isAvailable()).to.be.false;
    });

    it("shouldn't be available is fully loaded", async () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        worker.pendingCalls = 10;
        expect(worker.isAvailable()).to.be.false;
    });

    it("shouldn't be available is more than fully loaded", async () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);
        worker.pendingCalls = 20;
        expect(worker.isAvailable()).to.be.false;
    });

    it("should be available when ttl not reached", async () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

        for (let i = 0; i < 9; i++) {
            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        }

        expect(worker.isAvailable()).to.be.true;
    });

    it("shouldn't be available when ttl reached", () => {
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

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
        worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

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
            (worker.isAvailable as SinonStub).restore();
        }
    });

    describe("Events", () => {
        it("emit message", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            worker.once("message", () => {
                done();
            });

            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        });

        it("emit TTLExceeded", (done) => {
            worker = new Worker(100, childPath, {}, 1, 10, 1, 1);

            worker.once("TTLExceeded", () => {
                done();
            });

            worker.run(new Call({
                args: [],
                timeout: Infinity,
            }, () => true, () => false));
        });

        it("emit exit", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            worker.once("exit", () => {
                done();
            });

            worker.kill();
        });

        it("emit killed after exit", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

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
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            worker.once("killed", () => {
                done();
            });

            worker.kill();
        });

        it("shouldn't emit killed without calling kill", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

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
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            worker.once("close", () => {
                done();
            });

            worker.kill();
        });

        it("emit disconnect", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            worker.once("disconnect", () => {
                done();
            });

            worker.kill();
        });

        it("emit error", (done) => {
            worker = new Worker(100, childPath, {}, 10, 10, 1, 1);

            const err = new Error("boom");

            worker.once("error", (error) => {
                expect(error).to.deep.equal(err);
                done();
            });

            worker.process.emit("error", err);
        });
    });

    it("should be killed when silent", async () =>  {
        worker = new Worker(100, childPath, {
            silent: true,
        }, 10, 10, 1, 1);

        await worker.kill();

        expect(worker.killed).to.be.true;
    });

    it("should be killed when stdio ignored", async () =>  {
        worker = new Worker(100, childPath, {
            stdio: ["ignore", "ignore", "ignore", "ignore"],
        }, 10, 10, 1, 1);

        await worker.kill();

        expect(worker.killed).to.be.true;
    });

    it("should be killed when stdio is piped", async () =>  {
        worker = new Worker(100, childPath, {
            stdio: ["pipe", "pipe", "pipe", "pipe"],
        }, 10, 10, 1, 1);

        await worker.kill();

        expect(worker.killed).to.be.true;
    });
});
