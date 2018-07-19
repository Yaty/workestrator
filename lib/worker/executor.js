let $module;

function sendError(data, error) {
    const serializedError = {
        name: error.constructor.name,
    };

    Object.getOwnPropertyNames(error).forEach((p) => {
        serializedError[p] = error[p];
    });

    process.send({
        callId: data.callId,
        err: serializedError,
    });
}

function sendResponse(data, res) {
    process.send({
        callId: data.callId,
        res,
    });
}

async function handle(data) {
    try {
        if (data.method) {
            if ($module[data.method]) {
                sendResponse(data, await $module[data.method].apply($module, data.args));
            } else {
                sendError(data, new Error(`method "${data.method}" is not defined in module`));
            }
        } else {
            sendResponse(data, await $module.apply($module, data.args));
        }
    } catch (err) {
        sendError(data, err);
    }
}

process.on("message", async (data) => {
    if (!$module) {
        if (data.module) {
            try {
                $module = require(data.module);
            } catch (err) {
                sendError(data, err);
            }
        } else {
            sendError(data, new Error("The worker module is still not loaded, it can't be used."));
        }
    } else {
        await handle(data);
    }
});
