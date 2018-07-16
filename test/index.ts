import {expect} from "chai";
import "mocha";
import os from "os";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

const childPath = require.resolve("./child");

describe("Workhorse", () => {
    let farm: Farm;

    function createFarm(options?: object) {
        farm = create({
            module: childPath,
            ...options,
        });
    }

    beforeEach(() => {
        createFarm();
    });

    after(kill);

    describe("Factory", () => {
        it("should create a farm", () => {
            expect(farm.running).to.be.true;
        });

        it("should kill a farm", async () => {
            await farm.kill();
            expect(farm.running).to.be.false;
        });

        it("should kill all farms", async () => {
            await kill();
            expect(farm.running).to.be.false;
        });

        it("should have the valid default options", async () => {
            expect(farm.options.argv).to.deep.equal(process.argv);
            expect(farm.options.maxConcurrentCalls).to.equal(Infinity);
            expect(farm.options.maxConcurrentCallsPerWorker).to.equal(10);
            expect(farm.options.maxRetries).to.equal(Infinity);
            expect(farm.options.numberOfWorkers).to.equal(os.cpus().length);
            expect(farm.options.timeout).to.equal(Infinity);
            expect(farm.options.killTimeout).to.equal(500);
            expect(farm.options.ttl).to.equal(Infinity);
            expect(farm.options.fork).to.deep.equal({
                cwd: process.cwd(),
                env: process.env,
                execArgv: process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v)),
                execPath: process.execPath,
                silent: false,
            });
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

    describe("Performance", () => {
        // it("finds pi quickly", () => {});
        // it("should balance calls between workers according to the availability", () => {});
    });

    describe("Events", () => {
        // it("should emit workerMessage", async () => {});
    });
});
