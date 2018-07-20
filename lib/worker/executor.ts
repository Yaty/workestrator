import {MasterToWorkerMessage} from "../types";

let $module: any;

function serializeError(error: Error): object {
    const serializedError: any = {
        name: error.constructor.name,
    };

    Object.getOwnPropertyNames(error).forEach((p) => {
        serializedError[p] = (error as any)[p];
    });

    return serializedError;
}

function sendError(data: MasterToWorkerMessage, error: Error): void {
    (process as any).send({
        callId: data.callId,
        err: serializeError(error),
    });
}

function sendResponse(data: MasterToWorkerMessage, res?: any): void {
    (process as any).send({
        callId: data.callId,
        res,
    });
}

async function handle(data: MasterToWorkerMessage): Promise<void> {
    if (data.method) {
        if ($module[data.method]) {
            sendResponse(data, await $module[data.method].apply($module, data.args));
        } else {
            sendError(data, new Error(`method "${data.method}" is not defined in module`));
        }
    } else {
        sendResponse(data, await $module.apply($module, data.args));
    }
}

async function loadModule(module: string): Promise<void> {
    try {
        $module = await import(module);

        (process as any).send({
            moduleLoaded: true,
        });
    } catch (err) {
        (process as any).send({
            err: serializeError(err),
            moduleLoaded: false,
        });
    }
}

process.on("message", async (data) => {
    try {
        if (!$module) {
            if (data.module) {
                await loadModule(data.module);
            } else {
                sendError(data, new Error("The worker module is still not loaded, it can't be used."));
            }
        } else {
            await handle(data);
        }
    } catch (err) {
        sendError(data, err);
    }
});
