import {MasterToWorkerMessage} from "../types";
import Serializer from "./serializer/Serializer";

let $module: any;
let serializer: Serializer;
let loaded = false;

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
        moduleLoaded: loaded,
    });
}

async function sendResponse(data: MasterToWorkerMessage, res?: any): Promise<void> {
    (process as any).send({
        callId: data.callId,
        res: await serializer.encode(res),
    });
}

async function handle(data: MasterToWorkerMessage): Promise<void> {
    if (data.method) {
        if ($module[data.method]) {
            await sendResponse(data, await $module[data.method].apply($module, data.args));
        } else {
            sendError(data, new Error(`method "${data.method}" is not defined in module`));
        }
    } else {
        await sendResponse(data, await $module.apply($module, data.args));
    }
}

function loadModule(modulePath: string, serializerPath: string): void {
    if (!modulePath || !serializerPath) {
        throw new Error("The worker module is still not loaded, it can't be used.");
    }

    $module = require(modulePath);
    serializer = new (require(serializerPath))();

    loaded = true;

    (process as any).send({
        moduleLoaded: true,
    });
}

process.on("message", async (data) => {
    try {
        if (!loaded) {
            loadModule(data.module, data.serializer);
        } else {
            data.args = await serializer.decode(data.args);
            await handle(data);
        }
    } catch (err) {
        sendError(data, err);
    }
});
