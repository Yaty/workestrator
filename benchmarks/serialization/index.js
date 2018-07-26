const workhorse = require("../../dist");

const farmsOptions = {
    numberOfWorkers: 1,
    module: require.resolve("./child"),
    maxConcurrentCallsPerWorker: 1,
    maxRetries: 0,
};

function waitForWorkersToLoad(farm) {
    return new Promise((resolve) => {
        const itv = setInterval(() => {
            const readyWorkers = farm.workers.reduce((acc, w) => acc + Number(w.isAvailable()), 0);

            if (readyWorkers === farm.workers.length) {
                clearInterval(itv);
                resolve();
            }
        }, 50);
    });
}

const jsonFarm = workhorse.create({
    ...farmsOptions,
    serializerPath: workhorse.serializers.JSON,
});

const cborFarm = workhorse.create({
    ...farmsOptions,
    serializerPath: workhorse.serializers.CBOR,
});

const iterations = 500;

async function run(farm) {
    const calls = [];
    const data = {
        number: 1,
        string: "",
        object: {
            a: 1,
        },
        null: null,
        array: [1, "2", 3],
    };

    const startTime = process.hrtime();

    for (let i = 0; i < iterations; i++) {
        calls.push(farm.run(data))
    }

    await Promise.all(calls);

    const endTime = process.hrtime(startTime);
    const diff = (endTime[0] * 1000) + (endTime[1] / 1000000);
    console.log("Done in", diff, "ms");
}

/*
For this benchmarks we compare simple data types as:
- Number
- String
- Object (with null)
- Array
 */
(async () => {
    await waitForWorkersToLoad(jsonFarm);
    console.log("JSON Serializer :");
    await run(jsonFarm);

    await waitForWorkersToLoad(cborFarm);
    console.log("\nCBOR Serializer :");
    await run(cborFarm);
    process.exit(0);
})();