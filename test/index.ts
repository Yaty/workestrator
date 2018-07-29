import {expect} from "chai";
import "mocha";
import * as os from "os";
import {create, kill} from "../lib";
import Farm from "../lib/Farm";

const childPath = require.resolve("./child");

describe("Workestrator", () => {
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
            expect(farm.killed).to.be.false;
        });

        it("should kill a farm", async () => {
            await farm.kill();
            expect(farm.killed).to.be.true;
        });

        it("should kill all farms", async () => {
            await kill();
            expect(farm.killed).to.be.true;
        });

        it("should have the valid default options", async () => {
            const defaultOptions =  {
                fork: {
                    args: process.argv,
                    cwd: process.cwd(),
                    env: process.env,
                    execArgv: process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v)),
                    execPath: process.execPath,
                    silent: false,
                },
                killTimeout: 500,
                maxConcurrentCalls: Infinity,
                maxConcurrentCallsPerWorker: 10,
                maxIdleTime: Infinity,
                maxRetries: 3,
                module: childPath,
                numberOfWorkers: os.cpus().length,
                timeout: Infinity,
                ttl: Infinity,
            };

            for (const [key, value] of Object.entries(defaultOptions)) {
                expect((farm.options as any)[key]).to.deep.equal(value);
            }
        });
    });
});
