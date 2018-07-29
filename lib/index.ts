import * as assert from "assert";
import * as logger from "debug";
import * as fs from "fs";
import Farm from "./Farm";
import {FarmOptions, InternalFarmOptions} from "./types";
import {isNotNil, isPositive} from "./utils";
import Serializer from "./worker/serializer/Serializer";

const debug = logger("workestrator:main");
let farms: Farm[] = [];

const serializers = {
    CBOR: require.resolve("./worker/serializer/CBOR"),
    JSON: require.resolve("./worker/serializer/JSON"),
};

export { Serializer, serializers };

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
    maxIdleTime: Infinity,
    maxRetries: 3,
    module: "",
    numberOfWorkers: require("os").cpus().length,
    serializerPath: serializers.JSON,
    timeout: Infinity,
    ttl: Infinity,
};

function validateOptions(options: FarmOptions): void {
    assert(typeof options === "object" && isNotNil(options), "Workestrator options isn't an object.");

    const module = options.module;

    assert(fs.existsSync(module), `Provided workers module doesn't exists : ${module}`);
    assert(fs.statSync(module).isFile(), `Provided workers module isn't a file : ${module}`);

    if (isNotNil(options.ttl)) {
        assert(
            isPositive(options.ttl),
            `ttl should be > 0 : ${options.ttl}`,
        );
    }

    if (isNotNil(options.maxConcurrentCalls)) {
        assert(
            isPositive(options.maxConcurrentCalls),
            `maxConcurrentCalls should be > 0 : ${options.maxConcurrentCalls}`,
        );
    }

    if (isNotNil(options.maxConcurrentCallsPerWorker)) {
        assert(
            isPositive(options.maxConcurrentCallsPerWorker),
            `maxConcurrentCallsPerWorker should be > 0 : ${options.maxConcurrentCallsPerWorker}`,
        );
    }

    if (isNotNil(options.maxRetries)) {
        assert(
            isPositive(options.maxRetries) || options.maxRetries === 0,
            `maxRetries should be >= 0 : ${options.maxRetries}`,
        );
    }

    if (isNotNil(options.numberOfWorkers)) {
        assert(
            isPositive(options.numberOfWorkers),
            `numberOfWorkers should be > 0 : ${options.numberOfWorkers}`,
        );
    }

    if (isNotNil(options.timeout)) {
        assert(
            isPositive(options.timeout),
            `timeout should be > 0 : ${options.timeout}`,
        );
    }

    if (isNotNil(options.killTimeout)) {
        assert(
            isPositive(options.killTimeout),
            `timeout should be > 0 : ${options.killTimeout}`,
        );
    }

    if (isNotNil(options.serializerPath)) {
        assert(
            fs.existsSync(options.serializerPath!),
            `Provided serializer doesn't exists : ${options.serializerPath}`,
        );

        assert(
            fs.statSync(options.serializerPath!).isFile(),
            `Provided serializer isn't a file : ${options.serializerPath}`,
        );
    }

    if (isNotNil(options.maxIdleTime)) {
        assert(
            isPositive(options.maxIdleTime),
            `maxIdleTime should be > 0 : ${options.maxIdleTime}`,
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

export function kill(): void {
    farms.forEach((f) => f.kill());
    farms = [];
    debug("Farms killed.");
}
