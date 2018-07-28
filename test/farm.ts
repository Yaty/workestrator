import {expect} from "chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

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
            const results = await farm.broadcast(1);
            expect(results).to.have.lengthOf(farm.workers.length);

            for (const result of results) {
                expect(result).to.be.an("object");
                expect(result.pid).to.be.a("number");
                expect(result.rnd).to.be.within(0, 1);
                expect(result.args).to.deep.equal([1]);
            }

            const pids = results.map((r) => r.pid);
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
            const results = await farm.broadcastMethod("data", 1);
            expect(results).to.have.lengthOf(farm.workers.length);

            for (const result of results ) {
                expect(result).to.be.an("object");
                expect(result.pid).to.be.a("number");
                expect(result.args).to.deep.equal([1]);
            }

            const pids = results.map((r) => r.pid);
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
    });

    describe("Events", () => {
        it("emit workerMessage", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerMessage", (workerId, message) => {
                try {
                    expect(workerId).to.equal(f.workers[0].id);
                    expect(message.res.args[0]).to.equal(0);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.runMethod("run0");
        });

        it("emit workerTTLExceeded", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
                ttl: 1,
            });

            f.on("workerTTLExceeded", (workerId) => {
                try {
                    expect(workerId).to.equal(f.workers[0].id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.run();
        });

        it("emit workerExit", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerExit", (workerId) => {
                try {
                    expect(workerId).to.equal(f.workers[0].id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit workerKilled", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerKilled", (workerId) => {
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.kill();
        });

        it("emit workerClose", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerClose", (workerId) => {
                try {
                    expect(workerId).to.equal(f.workers[0].id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit workerDisconnect", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerDisconnect", (workerId) => {
                try {
                    expect(workerId).to.equal(f.workers[0].id);
                    done();
                } catch (err) {
                    done(err);
                }
            });

            f.kill();
        });

        it("emit workerError", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.on("workerModuleLoaded", () => {
                const err = new Error("boom");

                f.once("workerError", (workerId, error) => {
                    try {
                        expect(error).to.deep.equal(err);
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                f.workers[0].process.emit("error", err);
            });
        });

        it("emit killed", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("killed", () => {
                done();
            });

            f.kill();
        });

        it("emit workerModuleLoaded", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("workerModuleLoaded", () => {
                done();
            });
        });

        it("emit workerMaxIdleTime", (done) => {
            const f = create({
                maxIdleTime: 200,
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("workerMaxIdleTime", () => {
                done();
            });

            f.run();
        });
    });

    it("should not recreate workers when the farm is killed", async () => {
        const numberOfWorkers = 2;

        const f = create({
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);
        await f.kill();
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
});
