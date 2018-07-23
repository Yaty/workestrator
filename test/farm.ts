import {expect} from "chai";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";
import {waitForWorkersToLoad} from "./utils";

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
            expect(rnd).to.within(0, 1);
        });

        it("exports = function with args", async function() {
            const {args} = await farm.run(0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });

        it("exports.fn = function", async function() {
            const {pid, rnd} = await farm.runMethod("run0");

            expect(pid).to.be.a("number");
            expect(rnd).to.within(0, 1);
        });

        it("exports.fn = function with args", async function() {
            const {args} = await farm.runMethod("data", 0, 1, 2, "3");
            expect(args).to.deep.equal([0, 1, 2, "3"]);
        });
    });

    describe("Events", () => {
        it("emit workerMessage", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
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
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("emit workerTTLExceeded", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
                ttl: 1,
            });

            f.on("workerTTLExceeded", (workerId) => {
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.run();
        });

        it("emit workerExit", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
                    f.on("workerExit", (workerId) => {
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    });

                    f.kill();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("emit workerKilled", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
                    f.on("workerKilled", (workerId) => {
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    });

                    f.kill();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("emit workerClose", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
                    f.on("workerClose", (workerId) => {
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    });

                    f.kill();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("emit workerDisconnect", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
                    f.on("workerDisconnect", (workerId) => {
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    });

                    f.kill();
                })
                .catch((err) => {
                    done(err);
                });
        });

        it("emit workerError", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            waitForWorkersToLoad(f)
                .then(() => {
                    const err = new Error("boom");

                    f.once("workerError", (workerId, error) => {
                        expect(error).to.deep.equal(err);
                        expect(workerId).to.equal(f.workers[0].id);
                        done();
                    });

                    f.workers[0].process.emit("error", err);
                })
                .catch((err) => {
                    done(err);
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
    });

    it("should not recreate workers when the farm is killed", async () => {
        const numberOfWorkers = 2;

        const f = create({
            module: childPath,
            numberOfWorkers,
        });

        await waitForWorkersToLoad(f);

        expect(f.workers).to.have.lengthOf(numberOfWorkers);
        await f.kill();
        expect(f.workers).to.have.lengthOf(0);
        f.createWorkers();
        expect(f.workers).to.have.lengthOf(0);
    });

    it("should warn when trying to rotate an undefined worker", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        await waitForWorkersToLoad(f);

        const [worker] = f.workers;
        f.workers = [];

        worker.emit("exit");

        expect(f.workers).to.have.lengthOf(1);
    });
});
