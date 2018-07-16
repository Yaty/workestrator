import {ForkOptions} from "child_process";

export interface MasterToWorkerMessage {
    callId: number;
    args?: any[];
    module?: string;
    method?: string;
    workerId: number;
}

export interface WorkerToMasterMessage {
    callId: number;
    res?: any;
    err?: Error;
    workerId: number;
}

export interface CallOptions {
    args?: any[];
    method?: string;
    timeout: number;
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
    argv: string[];
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
    argv?: string[];
}
