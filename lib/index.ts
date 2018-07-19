import assert from "assert";
import logger from "debug";
import fs from "fs";
import Farm from "./Farm";
import {FarmOptions, InternalFarmOptions} from "./types";
import {isNil, isPositive, removeElements} from "./utils";

const debug = logger("workhorse:main");
const farms: Farm[] = [];

const execArgv = process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v));

const DEFAULT_FARM_OPTIONS: InternalFarmOptions = {
    fork: {
        args: process.argv,
        cwd: process.cwd(),
        env: process.env,
        execArgv,
        execPath: process.execPath,
        silent: false,
    },
    killTimeout: 500,
    maxConcurrentCalls: Infinity,
    maxConcurrentCallsPerWorker: 10,
    maxRetries: Infinity,
    module: "",
    numberOfWorkers: require("os").cpus().length,
    timeout: Infinity,
    ttl: Infinity,
};

function validateOptions(options: FarmOptions): void {
    assert(!isNil(options), "Workhorse options isn't an object.");

    const module = options.module;

    assert(fs.existsSync(module), `Provided workers module doesn't exists : ${module}`);
    assert(fs.statSync(module).isFile(), `Provided workers module isn't a file : ${module}`);

    if (!isNil(options.ttl)) {
        assert(
            isPositive(options.ttl),
            `ttl should be > 0 : ${options.ttl}`,
        );
    }

    if (!isNil(options.maxConcurrentCalls)) {
        assert(
            isPositive(options.maxConcurrentCalls),
            `maxConcurrentCalls should be > 0 : ${options.maxConcurrentCalls}`,
        );
    }

    if (!isNil(options.maxConcurrentCallsPerWorker)) {
        assert(
            isPositive(options.maxConcurrentCallsPerWorker),
            `maxConcurrentCallsPerWorker should be > 0 : ${options.maxConcurrentCallsPerWorker}`,
        );
    }

    if (!isNil(options.maxRetries)) {
        assert(
            isPositive(options.maxRetries) || options.maxRetries === 0,
            `maxRetries should be >= 0 : ${options.maxRetries}`,
        );
    }

    if (!isNil(options.numberOfWorkers)) {
        assert(
            isPositive(options.numberOfWorkers),
            `numberOfWorkers should be > 0 : ${options.numberOfWorkers}`,
        );
    }

    if (!isNil(options.timeout)) {
        assert(
            isPositive(options.timeout),
            `timeout should be > 0 : ${options.timeout}`,
        );
    }

    if (!isNil(options.killTimeout)) {
        assert(
            isPositive(options.killTimeout),
            `timeout should be > 0 : ${options.killTimeout}`,
        );
    }
}

export function create(options: FarmOptions): Farm {
    validateOptions(options);
    const createdFarm = new Farm(Object.assign({}, DEFAULT_FARM_OPTIONS, options));
    farms.push(createdFarm);
    debug("Farm created %d.", createdFarm.id);
    return createdFarm;
}

export async function kill(): Promise<void> {
    // Kill farms
    await Promise.all(
        farms.map((f) => f.kill()),
    );

    // Empty farms array
    removeElements(farms);

    debug("Farms killed.");
}
