import {ForkOptions as ForkBaseOptions} from "child_process";

export interface MasterToWorkerMessage {
    callId: number;
    args?: any[] | string;
    module?: string;
    method?: string;
    workerId: number;
    serializer?: string;
}

export interface WorkerToMasterMessage {
    callId: number;
    moduleLoaded?: boolean;
    res?: any;
    err?: Error;
    workerId: number;
}

export interface CallOptions {
    args?: any[];
    method?: string;
    timeout: number;
}

export interface ForkOptions extends ForkBaseOptions {
    args?: string[];
}

export interface InternalFarmOptions {
    maxConcurrentCalls: number;
    maxConcurrentCallsPerWorker: number;
    maxRetries: number;
    numberOfWorkers: number;
    ttl: number;
    timeout: number;
    killTimeout: number;
    fork: ForkOptions;
    module: string;
    serializerPath: string;
}

export interface FarmOptions {
    maxConcurrentCalls?: number;
    maxConcurrentCallsPerWorker?: number;
    maxRetries?: number;
    numberOfWorkers?: number;
    ttl?: number;
    timeout?: number;
    killTimeout?: number;
    fork?: ForkOptions;
    module: string;
    serializerPath?: string;
}
