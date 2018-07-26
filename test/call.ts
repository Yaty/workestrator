import {expect} from "chai";
import Call from "../lib/Call";
import {CallOptions} from "../lib/types";

describe("Call", () => {
    it("should be well initialized", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        function success() {
            return true;
        }

        function failure() {
            return false;
        }

        const call = new Call(options, success, failure);

        call.workerId = 0;
        call.timer = setTimeout(() => true, 0);

        expect(call).to.have.property("id").to.be.a("number");
        expect(call).to.have.property("retries").to.be.a("number");
        expect(call).to.have.property("args").to.deep.equal(options.args);
        expect(call).to.have.property("method").to.equal(options.method);
        expect(call).to.have.property("timeout").to.equal(options.timeout);
        expect(call).to.have.property("resolved").to.be.a("boolean");
        expect(call).to.have.property("rejected").to.be.a("boolean");
        expect(call).to.have.property("workerId").to.be.a("number");
        expect(call).to.have.property("timer");
        expect(call).to.have.property("resolve").to.be.a("function");
        expect(call).to.have.property("reject").to.be.a("function");
        expect(call).to.have.property("launchTimeout").to.be.a("function");
        expect(call).to.have.property("retry").to.be.a("function");
    });

    it("should resolve", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let resolved = false;

        function success() {
            resolved = true;
            return true;
        }

        function failure() {
            return false;
        }

        const call = new Call(options, success, failure);
        call.timer = setTimeout(() => true, 10000);
        call.resolve();

        expect(resolved).to.be.true;
        expect(call.resolved).to.be.true;
        expect(call.rejected).to.be.false;
        expect((call.timer as any)._idleTimeout).to.equal(-1);
    });

    it("shouldn't resolve twice", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let resolved = 0;

        function success() {
            resolved++;
            return true;
        }

        function failure() {
            return false;
        }

        const call = new Call(options, success, failure);
        call.resolve();
        call.resolve();

        expect(resolved).to.equal(1);
        expect(call.resolved).to.be.true;
        expect(call.rejected).to.be.false;
    });

    it("should reject", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let rejected = false;

        function success() {
            return false;
        }

        function failure() {
            rejected = true;
            return true;
        }

        const call = new Call(options, success, failure);
        call.timer = setTimeout(() => true, 10000);
        call.reject(new Error());

        expect(rejected).to.be.true;
        expect(call.resolved).to.be.false;
        expect(call.rejected).to.be.true;
        expect((call.timer as any)._idleTimeout).to.equal(-1);
    });

    it("shouldn't reject twice", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let rejected = 0;

        function success() {
            return true;
        }

        function failure() {
            rejected++;
            return false;
        }

        const call = new Call(options, success, failure);
        call.reject(new Error());
        call.reject(new Error());

        expect(rejected).to.equal(1);
    });

    it("shouldn't reject after resolve", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let resolved = false;
        let rejected = false;

        function success() {
            resolved = true;
            return true;
        }

        function failure() {
            rejected = true;
            return false;
        }

        const call = new Call(options, success, failure);
        call.resolve();
        call.reject(new Error());

        expect(resolved).to.be.true;
        expect(rejected).to.be.false;
        expect(call.resolved).to.be.true;
        expect(call.rejected).to.be.false;
    });

    it("shouldn't resolve after reject", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        let resolved = false;
        let rejected = false;

        function success() {
            resolved = true;
            return true;
        }

        function failure() {
            rejected = true;
            return false;
        }

        const call = new Call(options, success, failure);
        call.reject(new Error());
        call.resolve();

        expect(resolved).to.be.false;
        expect(rejected).to.be.true;
        expect(call.resolved).to.be.false;
        expect(call.rejected).to.be.true;
    });

    it("should retry", () => {
        const options: CallOptions = {
            args: [1, "2"],
            method: "abc",
            timeout: 123,
        };

        function success() {
            return true;
        }

        function failure() {
            return false;
        }

        const call = new Call(options, success, failure);
        call.retry();

        expect(call.retries).to.equal(1);
        expect(call.workerId).to.be.undefined;
        expect(call.rejected).to.be.false;
        expect(call.resolved).to.be.false;
    });
});
