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

            f.once("workerMessage", (workerId, message) => {
                expect(workerId).to.equal(f.workers[0].id);
                expect(message.res.args[0]).to.equal(0);
                done();
            });

            f.runMethod("run0");
        });

        it("emit workerTTLExceeded", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
                ttl: 1,
            });

            f.once("workerTTLExceeded", (workerId) => {
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

            f.once("workerExit", (workerId) => {
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.kill();
        });

        it("emit workerKilled", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("workerKilled", (workerId) => {
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

            f.once("workerClose", (workerId) => {
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.kill();
        });

        it("emit workerDisconnect", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            f.once("workerDisconnect", (workerId) => {
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.kill();
        });

        it("emit workerError", (done) => {
            const f = create({
                module: childPath,
                numberOfWorkers: 1,
            });

            const err = new Error("boom");

            f.once("workerError", (workerId, error) => {
                expect(error).to.deep.equal(err);
                expect(workerId).to.equal(f.workers[0].id);
                done();
            });

            f.workers[0].process.emit("error", err);
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
    });

    it("should not recreate workers when the farm is killed", async () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        await f.kill();
        expect(f.workers).to.have.lengthOf(0);
        f.createWorkers();
        expect(f.workers).to.have.lengthOf(0);
    });

    it("should warn when trying to rotate an undefined worker", () => {
        const f = create({
            module: childPath,
            numberOfWorkers: 1,
        });

        const [worker] = f.workers;
        f.workers = [];

        worker.emit("exit");

        try {
            expect(f.workers).to.have.lengthOf(1);
        } catch (err) {
            throw err;
        }
    });
});
