module.exports = function(...args) {
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
        gid: process.platform !== "win32" ? process.getgid() : -1,
        uid: process.platform !== "win32" ? process.getuid() : -1,
        pid: process.pid,
    };
};

module.exports.run0 = async function() {
    return await module.exports(0);
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

module.exports.failTimeout = function(timeout) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error());
        }, timeout || 500);
    });
};

module.exports.randomError = function() {
    if (Math.random() > 0.5) {
      throw new Error("Random error")
    }

    return 0;
};

module.exports.exit = function() {
    process.exit(0);
};
