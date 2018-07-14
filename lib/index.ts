import assert from "assert";
import logger from "debug";
import fs from "fs";
import Farm from "./Farm";
import {FarmOptions, InternalFarmOptions} from "./types";
import * as utils from "./utils";

const debug = logger("workhorse:main");
const farms: Farm[] = [];

const DEFAULT_FARM_OPTIONS: InternalFarmOptions = {
    argv: process.argv,
    fork: {
        cwd: process.cwd(),
        env: process.env,
        execArgv: process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v)),
        execPath: process.execPath,
        silent: false,
    },
    killTimeout: 100,
    maxConcurrentCalls: Infinity,
    maxConcurrentCallsPerWorker: 10,
    maxRetries: Infinity,
    module: "",
    numberOfWorkers: require("os").cpus().length,
    queueIntervalCheck: 100,
    timeout: Infinity,
    ttl: Infinity,
};

function validateOptions(options: FarmOptions) {
    assert(typeof options === "object" && options !== null, "Workhorse options isn't an object.");

    const module = options.module;

    assert(fs.existsSync(module), `Provided workers module doesn't exists : ${module}`);
    assert(fs.statSync(module).isFile(), `Provided workers module isn't a file : ${module}`);

    if (typeof options.ttl !== "undefined" && options.ttl !== null) {
        assert(
            typeof options.ttl === "number" && options.ttl > 0,
            `ttl should be a positive number : ${options.ttl}`,
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

export async function kill() {
    // Kill farms
    await Promise.all(
        farms.map((f) => f.kill()),
    );

    // Empty farms array
    utils.removeElements(farms);

    debug("Farms killed.");
}

export default create;
