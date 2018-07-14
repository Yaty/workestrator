"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const debug_1 = __importDefault(require("debug"));
const fs_1 = __importDefault(require("fs"));
const Farm_1 = __importDefault(require("./Farm"));
const utils = __importStar(require("./utils"));
const debug = debug_1.default("workhorse:main");
const farms = [];
const DEFAULT_FARM_OPTIONS = {
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
function validateOptions(options) {
    assert_1.default(typeof options === "object" && options !== null, "Workhorse options isn't an object.");
    const module = options.module;
    assert_1.default(fs_1.default.existsSync(module), `Provided workers module doesn't exists : ${module}`);
    assert_1.default(fs_1.default.statSync(module).isFile(), `Provided workers module isn't a file : ${module}`);
    if (typeof options.ttl !== "undefined" && options.ttl !== null) {
        assert_1.default(typeof options.ttl === "number" && options.ttl > 0, `ttl should be a positive number : ${options.ttl}`);
    }
}
function create(options) {
    validateOptions(options);
    const createdFarm = new Farm_1.default(Object.assign({}, DEFAULT_FARM_OPTIONS, options));
    farms.push(createdFarm);
    debug("Farm created %d.", createdFarm.id);
    return createdFarm;
}
exports.create = create;
function kill() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(farms.map((f) => f.kill()));
        utils.removeElements(farms);
        debug("Farms killed.");
    });
}
exports.kill = kill;
exports.default = create;
