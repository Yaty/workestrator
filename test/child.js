const fs = require("fs");
const started = Date.now();

module.exports = async function(...args) {
    return new Promise((resolve) => {
        const data = {
            pid: process.pid,
            rnd: Math.random(),
            args,
        };

        const timeout = args.length > 0 ? args[0] : null;

        if (timeout) {
            return setTimeout(() => resolve(data), timeout);
        }

        resolve(data);
    });
};

module.exports.data = function(...args) {
    return {
        argv: process.argv,
        cwd: process.cwd(),
        execArgv: process.execArgv,
        execPath: process.execPath,
        env: process.env,
        args,
        gid: process.getgid(),
        uid: process.getuid(),
    };
};

module.exports.run0 = async function() {
    return await module.exports(0);
};

module.exports.std = function() {
    process.stdout.write("stdout\n");
    process.stderr.write("stderr\n");
    // process.stdin.write("stdin");
};

module.exports.killable = function(id) {
    if (Math.random() < 0.5) {
        return process.exit(-1);
    }

    return {
        id,
        pid: process.pid,
    };
};

module.exports.err = function(type, message) {
    switch (type) {
        case "TypeError": throw new TypeError(message);
        case "RangeError": throw new RangeError(message);
        case "EvalError": throw new EvalError(message);
        case "ReferenceError": throw new ReferenceError(message);
        case "SyntaxError": throw new SyntaxError(message);
        case "URIError": throw new URIError(message);
        default: throw new Error(message);
    }
};

module.exports.block = function() {
    while (true) {}
};

// use provided file path to save retries count among terminated workers
module.exports.stubborn = function(path) {
    function isOutdated(p) {
        return ((new Date()).getTime() - fs.statSync(p).mtime.getTime()) > 2000;
    }

    // file may not be properly deleted, check if modified no earler than two seconds ago
    if (!fs.existsSync(path) || isOutdated(path)) {
        fs.writeFileSync(path, "1");
        process.exit(-1);
    }

    const retry = parseInt(fs.readFileSync(path, "utf8"), 10);

    if (Number.isNaN(retry)) {
        throw new Error("file contents is not a number");
    }

    if (retry > 4) {
        return 12;
    } else {
        fs.writeFileSync(path, String(retry + 1));
        process.exit(-1);
    }
};

module.exports.uptime = function() {
   return Date.now() - started;
};
