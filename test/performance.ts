import {expect} from "chai";
import {create, kill} from "../lib";
import {waitForWorkersToLoad} from "./utils";

const childPath = require.resolve("./child");

describe("Performance", () => {
    after(kill);

    it("should balance calls, basic case", async () => {
        const maxConcurrentCallsPerWorker = 10;
        const numberOfWorkers = 10;

        const f = create({
            maxConcurrentCallsPerWorker,
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);

        await waitForWorkersToLoad(f);

        const divisor = 2;

        for (let i = 0; i < (maxConcurrentCallsPerWorker * numberOfWorkers) / divisor; i++) {
            f.runMethod("block");
        }

        for (let i = 0; i < numberOfWorkers; i++) {
            expect(f.workers[i].pendingCalls).to.equal(maxConcurrentCallsPerWorker / divisor);
        }
    });

    it("should balance calls, pre-feeding a worker", async () => {
        const maxConcurrentCallsPerWorker = 100;
        const numberOfWorkers = 10;

        const f = create({
            maxConcurrentCallsPerWorker,
            module: childPath,
            numberOfWorkers,
        });

        expect(f.workers).to.have.lengthOf(numberOfWorkers);

        await waitForWorkersToLoad(f);
        f.workers[0].pendingCalls = maxConcurrentCallsPerWorker;

        const divisor = 2;
        const numberOfCalls = (maxConcurrentCallsPerWorker * numberOfWorkers) / divisor;

        for (let i = 0; i < numberOfCalls; i++) {
            f.runMethod("block");
        }

        const pendingCalls = f.workers.reduce((sum, w) => sum + w.pendingCalls, 0);
        expect(pendingCalls).to.equal(numberOfCalls + maxConcurrentCallsPerWorker);

        const loads = f.workers.map((w) => w.pendingCalls / maxConcurrentCallsPerWorker);
        expect(loads[0]).to.equal(1);

        const avg = ((numberOfCalls + maxConcurrentCallsPerWorker) / numberOfWorkers) / maxConcurrentCallsPerWorker;

        for (let i = 1; i < numberOfWorkers; i++) {
            expect(loads[i]).to.be.closeTo(avg, 0.05);
        }
    });
});
