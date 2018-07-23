import {AssertionError} from "assert";
import {expect} from "chai";
import * as path from "path";
import {create, kill, Serializers} from "../lib";

const childPath = require.resolve("./child");

describe("Validation", () => {
    after(kill);

    [undefined, null, 0, [], ""].forEach((options) => {
        it(`shouldn't allow '${typeof options}' options : ${options}`, () => {
            expect(() => create(options as any)).to.throw(AssertionError);
        });
    });

    it("should allow an object as options", () => {
        expect(() => create({
            module: childPath,
        })).to.not.throw;
    });

    [-1, 0, [], {}].forEach((maxConcurrentCalls) => {
        it(`shouldn't allow '${typeof maxConcurrentCalls}' maxConcurrentCalls : ${maxConcurrentCalls}`, () => {
            expect(() => create({
                maxConcurrentCalls: maxConcurrentCalls as any,
                module: childPath,
            })).to.throw(AssertionError);
        });
    });

    it("should allow maxConcurrentCalls > 0", () => {
        expect(() => create({
            maxConcurrentCalls: 1,
            module: childPath,
        })).to.not.throw;
    });

    [-1, 0, [], {}].forEach((maxConcurrentCallsPerWorker) => {
        it(`shouldn't allow '${typeof maxConcurrentCallsPerWorker}' ` +
            `maxConcurrentCallsPerWorker : ${maxConcurrentCallsPerWorker}`,
            () => {
                expect(() => create({
                    maxConcurrentCallsPerWorker: maxConcurrentCallsPerWorker as any,
                    module: childPath,
                })).to.throw(AssertionError);
            },
        );
    });

    it("should allow maxConcurrentCallsPerWorker > 0", () => {
        expect(() => create({
            maxConcurrentCallsPerWorker: 1,
            module: childPath,
        })).to.not.throw;
    });

    [-1, [], {}].forEach((maxRetries) => {
        it(`shouldn't allow '${typeof maxRetries}' maxRetries : ${maxRetries}`, () => {
            expect(() => create({
                maxRetries: maxRetries as any,
                module: childPath,
            })).to.throw(AssertionError);
        });
    });

    it("should allow maxRetries >= 0", () => {
        expect(() => create({
            maxRetries: 0,
            module: childPath,
        })).to.not.throw;
    });

    [-1, 0, [], {}].forEach((numberOfWorkers) => {
        it(`shouldn't allow '${typeof numberOfWorkers}' numberOfWorkers : ${numberOfWorkers}`, () => {
            expect(() => create({
                module: childPath,
                numberOfWorkers: numberOfWorkers as any,
            })).to.throw(AssertionError);
        });
    });

    it("should allow numberOfWorkers > 0", () => {
        expect(() => create({
            module: childPath,
            numberOfWorkers: 1,
        })).to.not.throw;
    });

    [-1, 0, [], {}, ""].forEach((ttl) => {
        it(`shouldn't allow '${typeof ttl}' ttl : ${ttl}`, () => {
            expect(() => create({
                module: childPath,
                ttl: ttl as any,
            })).to.throw(AssertionError);
        });
    });

    it("should allow ttl > 0", () => {
        expect(() => create({
            module: childPath,
            ttl: 1,
        })).to.not.throw;
    });

    [-1, 0, [], {}].forEach((timeout) => {
        it(`shouldn't allow '${typeof timeout}' timeout : ${timeout}`, () => {
            expect(() => create({
                module: childPath,
                timeout: timeout as any,
            })).to.throw(AssertionError);
        });
    });

    it("should allow timeout > 0", () => {
        expect(() => create({
            module: childPath,
            timeout: 1,
        })).to.not.throw;
    });

    [-1, 0, [], {}].forEach((killTimeout) => {
        it(`shouldn't allow '${typeof killTimeout}' killTimeout : ${killTimeout}`, () => {
            expect(() => create({
                killTimeout: killTimeout as any,
                module: childPath,
            })).to.throw(AssertionError);
        });
    });

    it("should allow killTimeout > 0", () => {
        expect(() => create({
            killTimeout: 1,
            module: childPath,
        })).to.not.throw;
    });

    [path.resolve(__dirname, "../test"), path.resolve(__dirname, "./do_not_exists"), [], {}, undefined, null]
        .forEach((module) => {
            it(`shouldn't allow '${typeof module}' module : ${module}`, () => {
                expect(() => create({
                    module: module as any,
                })).to.throw(AssertionError);
            });
        });

    it("should allow module as an existing file", () => {
        expect(() => create({
            module: childPath,
        })).to.not.throw;
    });

    [path.resolve(__dirname, "../test"), path.resolve(__dirname, "do_not_exists"), [], {}, undefined, null, ""]
        .forEach((serializerPath) => {
            it(`shouldn't allow '${typeof serializerPath}' serializerPath : ${serializerPath}`, () => {
                expect(() => create({
                    module: childPath,
                    serializerPath: serializerPath as any,
                })).to.throw(AssertionError);
            });
        });

    it("should allow a valid serializerPath : JSON", () => {
        expect(() => create({
            module: childPath,
            serializerPath: Serializers.JSON,
        })).to.not.throw;
    });

    it("should allow a valid serializerPath : CBOR", () => {
        expect(() => create({
            module: childPath,
            serializerPath: Serializers.CBOR,
        })).to.not.throw;
    });
});
