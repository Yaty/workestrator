'use strict';

const NUMBER_OF_CALLS = 500;
const POINTS_PER_CHILD = 1000000;
const FARM_OPTIONS = {
    numberOfWorkers: require('os').cpus().length,
    maxCallsPerWorker: Infinity,
    maxConcurrentCallsPerWorker : 1,
    module: require.resolve('./calc'),
};

const workestrator = require('../../dist');
const calcDirect = require('./calc');
const calcFarm = workestrator.create(FARM_OPTIONS);

function printResult(start, ret) {
    const pi  = ret.reduce((a, b) => a + b) / ret.length;
    const end = process.hrtime(start);
    const diff = (end[0] * 1000) + (end[1] / 1000000);

    console.log('π ≈', pi, '\t(' + Math.abs(pi - Math.PI), 'away from actual!)');
    console.log('took', diff, 'milliseconds');
}

async function calc(context, method) {
    const ret = [];
    const start = process.hrtime();

    for (let i = 0; i < NUMBER_OF_CALLS; i++) {
        ret.push(method.call(context, POINTS_PER_CHILD));
    }

    printResult(start, await Promise.all(ret));
}

(async () => {
    console.log('Doing it the slow (single-process) way...');
    await calc(null, calcDirect);

    console.log('Doing it the fast (multi-process) way...');
    await calc(calcFarm, calcFarm.run);

    workestrator.kill();
    process.exit(0);
})();
