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
        expect(res.execArgv).to.deep.equal(execArgv);
        expect(res.execPath).to.deep.equal(execPath);
        expect(res.argv).to.deep.equal([
            process.execPath,
            path.resolve(__dirname, "../lib/worker/executor.js"),
            ...args,
        ]);
    });
});
