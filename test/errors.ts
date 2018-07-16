import {expect} from "chai";
import {create, kill} from "../lib";

const childPath = require.resolve("./child");

describe("Errors", () => {
    after(kill);

    [
        TypeError,
        RangeError,
        EvalError,
        ReferenceError,
        SyntaxError,
        URIError,
        Error,
    ]
        .forEach((errorType) => {
            it(`should handle a ${errorType.name} error`, async () => {
                const farm = create({
                    maxRetries: 0,
                    module: childPath,
                    numberOfWorkers: 1,
                });

                try {
                    await farm.runMethod("err", errorType.name, "1");
                } catch (err) {
                    expect(err).to.be.instanceOf(errorType);
                    expect(err.name).to.equal(errorType.name);
                    expect(err.message).to.equal("1");
                    expect(err).to.have.property("stack");
                }
            });
        });

    describe("CallMaxRetryError", () => {
        it("should expose the error which caused the worker to crash multiple times", async () => {
            const maxRetries = 2;

            const farm = create({
                maxRetries,
                module: childPath,
                numberOfWorkers: 1,
            });

            try {
                await farm.runMethod("err", "TypeError", "1");
            } catch (err) {
                expect(err.name).to.equal("CallMaxRetryError");
                expect(err.reason).to.be.instanceOf(TypeError);
                expect(err.reason.name).to.equal("TypeError");
                expect(err.reason.message).to.equal("1");
                expect(err.reason).to.have.property("stack");
            }
        });
    });
});
