import {expect} from "chai";
import path from "path";
import {create, kill} from "../lib";

const childPath = require.resolve("./child");

describe("Fork", () => {
    after(kill);

    it("should use fork options", async () => {
        const cwd = path.resolve(__dirname, "../examples");
        const env = {
            foo: "bar",
        };
        const execPath = process.execPath;
        const execArgv = ["--expose-gc", "--harmony"];
        const args = ["0", "1"];

        const farm = create({
            fork: {
                args,
                cwd,
                env,
                execArgv,
                execPath,
            },
            module: childPath,
        });

        const res = await farm.runMethod("data");
        expect(res.cwd).to.equal(cwd);
        expect(res.env.foo).to.equal(env.foo);
        expect(res.execArgv).to.include("--expose-gc");
        expect(res.execArgv).to.include("--harmony");
        expect(res.execPath).to.deep.equal(execPath);
        expect(res.argv).to.deep.equal([
            process.execPath,
            path.resolve(__dirname, "../lib/worker/executor.js"),
            ...args,
        ]);
    });

    it("should remove debug and inspect from execArgv", async () => {
        try {
            process.execArgv.push("--debug", "--inspect");

            const farm = create({
                module: childPath,
            });

            const res = await farm.runMethod("data");
            expect(res.execArgv).to.not.include("--debug");
            expect(res.execArgv).to.not.include("--inspect");
        } catch (err) {
            throw err;
        } finally {
            process.execArgv.splice(process.execArgv.findIndex((a) => a === "--debug"), 1);
            process.execArgv.splice(process.execArgv.findIndex((a) => a === "--inspect"), 1);
        }
    });
});
