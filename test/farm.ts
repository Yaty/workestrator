/* tslint:disable:no-console */

import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

chai.use(sinonChai);

const {expect} = chai;
const childPath = require.resolve("./child");

describe("Farm", () => {
    after(kill);

    let farm: Farm;

    before(() => {
        farm = create({
            module: childPath,
        });
    });

    describe("Functions", () => {
        it("exports = function", async function() {
            const {pid, rnd} = await farm.run(0);
            expect(pid).to.be.a("number");
            expect(rnd).to.be.within(0, 1);
        });

        it("exports = function with args", async function() {
            const {args} = await farm.run(0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });

        it("exports.fn = function", async function() {
            const {pid, rnd} = await farm.runMethod("run0");

            expect(pid).to.be.a("number");
            expect(rnd).to.be.within(0, 1);
        });

        it("exports.fn = function with args", async function() {
            const {args} = await farm.runMethod("data", 0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });

        it("should broadcast to all workers the default method", async () => {
            const [successes, failures] = await farm.broadcast(1);
            expect(successes).to.have.lengthOf(farm.workers.length);
            expect(failures).to.have.lengthOf(0);

            for (const result of successes) {
                expect(result).to.be.an("object");
                expect(result.pid).to.be.a("number");
                expect(result.rnd).to.be.within(0, 1);
                expect(result.args).to.deep.equal([1]);
            }

            const pids = successes.map((r: any) => r.pid);
            expect(pids).to.have.lengthOf(farm.workers.length);

            for (const pid of pids) {
                let occurrence = 0;

                for (const pid2 of pids) {
                    if (pid === pid2) {
                        occurrence++;
                    }
                }

                expect(occurrence).to.equal(1);
            }
        });

        it("should broadcast to all workers a method", async () => {
            const [successes, failures] = await farm.broadcastMethod("data", 1);
            expect(successes).to.have.lengthOf(farm.workers.length);
            expect(failures).to.have.lengthOf(0);

            for (const result of successes) {
                expect(result).to.be.an("object");
                expect(result.pid).to.be.a("number");
                expect(result.args).to.deep.equal([1]);
            }

            const pids = successes.map((r) => r.pid);
            expect(pids).to.have.lengthOf(farm.workers.length);

            for (const pid of pids) {
                let occurrence = 0;

                for (const pid2 of pids) {
                    if (pid === pid2) {
                        occurrence++;
                    }
                }

                expect(occurrence).to.equal(1);
            }
        });

        it("should broadcast and return errors with success", async () => {
            const f = create({
                maxRetries: 0,
                module: childPath,
                numberOfWorkers: 4,
            });

            let successes;
            let failures;

            do {
                [successes, failures] = await f.broadcastMethod("randomError");
            } while (successes.length === 0 || failures.length === 0);

            expect(successes.length + failures.length).to.equal(f.workers.length);

            for (const result of successes) {
                expect(result).to.equal(0);
            }

            for (const error of failures) {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Random error");
            }
        });
    });

    describe("Events", () => {
        it("emit message", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("message", (worker, message) => {
                try {
                    expect(worker.id).to.equal(f.workers[0].id);
                    expect(message.res.args[0]).to.equal(0);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.runMethod("run0");
        });

        it("emit exit", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            const [worker] = f.workers;

            f.on("exit", (w) => {
                try {
                    expect(w.id).to.equal(worker.id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit close", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            const [worker] = f.workers;

            f.on("close", (w) => {
                try {
                    expect(w.id).to.equal(worker.id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit disconnect", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            const [worker] = f.workers;

            f.on("disconnect", (w) => {
                try {
                    expect(w.id).to.equal(worker.id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit error", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("online", () => {
                const err = new Error("boom");

                f.once("error", (w, error) => {
                    try {
                        expect(error).to.deep.equal(err);
                        expect(w.id).to.equal(f.workers[0].id);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                f.workers[0].process.emit("error", err);
            });
        });

        it("emit online", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("online", (w) => {
                expect(w.id).to.equal(f.workers[0].id);
                done();
            });
        });

        it("emit idle", (done) => {
            const f = create({
                maxIdleTime: 200,
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("idle", (w) => {
                expect(w.id).to.equal(f.workers[0].id);
                done();
            });

            f.run();
        });

        it("emit ttl", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
                ttl: 1,
            });

            f.on("ttl", (w) => {
                expect(w.id).to.equal(f.workers[0].id);
                done();
            });

            f.run();
        });

        it("emit fork", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
                ttl: 1,
            });

            f.on("fork", (w) => {
                expect(w.id).to.equal(f.workers[0].id);
                done();
            });

            f.run();
        });
    });

    it("should not recreate workers when the farm is killed", () => {
        const numberOfWorkers = 2;

        const f = create({
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);
        f.kill();
        expect(f.workers).to.have.lengthOf(0);
        f.createWorkers();
        expect(f.workers).to.have.lengthOf(0);
    });

    it("should recreate worker on exit", () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        const [worker] = f.workers;
        f.workers = [];

        worker.emit("exit");

        expect(f.workers).to.have.lengthOf(1);
    });

    it("should warn when receiving an unknown call", () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        sinon.stub(console, "error");

        const o = {};
        (f as any).receive(o);

        try {
            expect(console.error).to.have.been.calledOnce;
            expect((console.error as sinon.SinonStub).args[0][0])
                .to.equal("Workestrator : An unknown call was received. This should not happen.");
            expect((console.error as sinon.SinonStub).args[0][1]).to.equal(o);
        } finally {
            (console.error as sinon.SinonStub).restore();
        }
    });

    it("should do nothing when trying to remove an unknown call from pending", () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        sinon.stub(console, "error");

        const callId = 0;
        (f as any).removeCallFromPending(callId);

        try {
            expect(console.error).to.have.been.calledOnce;
            expect((console.error as sinon.SinonStub).args[0][0])
                .to.equal("Workestrator : The call is already removed. This should not happen.");
            expect((console.error as sinon.SinonStub).args[0][1]).to.equal(callId);
        } finally {
            (console.error as sinon.SinonStub).restore();
        }
    });
});
