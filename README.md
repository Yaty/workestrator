<a href="https://coveralls.io/github/Yaty/workestrator?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/Yaty/workestrator/badge.svg?branch=master" alt="Coverage Status" data-canonical-src="https://coveralls.io/github/Yaty/workestrator?branch=master" style="max-width:100%;"/></a>
<a href="https://travis-ci.org/Yaty/workestrator" target="_blank"><img src="https://travis-ci.org/Yaty/workestrator.svg?branch=master" alt="Build Status" data-canonical-src="https://travis-ci.org/Yaty/workestrator" style="max-width:100%;"/></a>
<a href="https://snyk.io/test/github/Yaty/workestrator" target="_blank"><img src="https://snyk.io/test/github/Yaty/workestrator/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/Yaty/workestrator" style="max-width:100%;"/></a>
<img src="https://img.shields.io/github/license/Yaty/workestrator.svg"/>

# Workhorse

Workhorse is a library to distribute tasks to child processes. It is written in TypeScript and use ES2017 features.
This project is highly inspired by [`node-worker-farm`](https://github.com/rvagg/node-worker-farm) and add some new features.

## Features

1. Concurrency options
2. Durability / Resilience : when a call fails it will be re-queued automatically (according to the farm options).
3. Async/Await support out of the box
4. Events
5. Serializers : You can choose among several serializers according to the data types you send to the workers. You can also write your own :)

## Usage

```js
const workhorse = require("workhorse");

const farm = workhorse.create({
    module: "/absolute/path/to/the/worker/module.js",
});

try {
    await farm.run(1, 2, 3); // returns 6
    await farm.runMethod("foo", 1, 2, 3); // returns "foo:1:2:3"
} catch (err) {
    console.log("Oh ... it failed :(", err);
}
```

And the module is :

```js
module.exports = function(a, b, c) {
    return a + b + c;
};

module.exports.foo = function(a, b, c) {
    return `foo:${a}:${b}:${c}`;
};
```

## Examples

### Approximating π

```
Doing it the slow (single-process) way...
π ≈ 3.141597687999999   (0.000005034410206050666 away from actual!)
took 12217 milliseconds

Doing it the fast (multi-process) way...
π ≈ 3.1415487919999996  (0.000043861589793525724 away from actual!)
took 3425 milliseconds
```

[See the full example with code here !](./examples/pi)

## API

### Workhorse

#### workhorse.create(options)

Create a new farm.

```js
const workhorse = require("workhorse");

const farm = workhorse.create({
    module: "/absolute/path/to/the/worker/module.js"
});
```

##### `options`

Options is an object, the default values are :

```
{
    fork: {
        args: process.argv,
        cwd: process.cwd(),
        env: process.env,
        execArgv: process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v)),
        execPath: process.execPath,
        silent: false,
    },
    killTimeout: 500,
    maxConcurrentCalls: Infinity,
    maxConcurrentCallsPerWorker: 10,
    maxIdleTime: Infinity,
    maxRetries: Infinity,
    numberOfWorkers: require("os").cpus().length,
    serializerPath: workhorse.Serializers.JSON
    timeout: Infinity,
    ttl: Infinity,
}
```

- **`module`** (*mandatory !*) : Absolute path to your module.
- **`fork`** : Fork options used for each worker ([see Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_child_process_fork_modulepath_args_options))
- **`killTimeout`** : The amount of time in ms for a worker to exit gracefully before killing it like butchers with SIGKILL.
- **`maxConcurrentCalls`** : The maximum number of calls in the farm queue, i.e. : calls being processed by workers + calls waiting in the queue.
- **`maxConcurrentCallsPerWorker`** : The maximum number of calls a worker can execute concurrently.
- **`maxIdleTime`** : The maximum amount of time a worker can live without receiving a call. It will kill the worker and restart another one according to your policy.
- **`maxRetries`** : How many times a call should be retried before failing once and for all, it will throw a CallMaxRetryError with the original error in the `reason` property if this is reached.
- **`numberOfWorkers`** : The amount of workers in the farm.
- **`serializerPath`** : Absolute path to the serializer, Workhorse provides two serializers (JSON for basic data types, CBOR for complex data types). [See `Serializers` section.](#serializers)
- **`timeout`** : A call will have to finish under `timeout` ms. It will throw a TimeoutError. It will be retried according to the farm options.
- **`ttl`** : The amount of calls a worker can execute. The worker will be killed, his tasks will be redistributed to other workers. A new worker will be created.

#### workhorse.kill()

Kill all farms. Async.

```js
try {
    await workhorse.kill();
} catch (err) {
    console.log("Error while killing farms.", err);
}
```

### Farm

#### farm.run(...args)

Run the default exported function in your module with arguments. Async.

```js
try {
    const res = await farm.run(1, [], "");
    console.log("Result :", res);
} catch (err) {
    console.log("Oh no :'(", err);
}
```

#### farm.runMethod(method, ...args)

Run a specific function in your module. Async.

```js
try {
    // bar is a function exported with : module.exports.bar = function ...
    const res = await farm.runMethod("bar", 1, [], "");
    console.log("Result :", res);
} catch (err) {
    console.log("Oh no :'(", err);
}
```

#### farm.kill(): void

Kill the farm. Async.

```js
try {
    await farm.kill();
} catch (err) {
    console.log("Error while killing farm.", err);
}
```

### Worker

You can access a worker trough the `farm.workers` array.

## Serializers

According to the data you send and receive to your workers you might need to use a different serializer.
Data needs to be serialized in order to be sent to the worker process.

Two serializers are available :
1. JSON (default, Node.js internal serializer), supported types :
    - boolean
    - number (without -0, NaN, and ±Infinity)
    - string
    - Array
    - Object
2. [CBOR](https://github.com/hildjj/node-cbor), supported types :
    - boolean
    - number (including -0, NaN, and ±Infinity)
    - string
    - Array, Set (encoded as Array)
    - Object (including null), Map
    - undefined
    - Buffer
    - Date,
    - RegExp
    - url.URL (Legacy URL API)
    - [bignumber](https://github.com/MikeMcl/bignumber.js)

For performances you might want to check [the benchmark](./benchmarks/serialization).

You can also build your own serializer. You need to extends the Serializer class :

```js
 const {Serializer} = require("workhorse");

class MySerializer extends Serializer {
    encode(data) {
        // do some encoding
        return data;
    }

    decode(data) {
        // do some decoding
        return data;
    }
}

module.exports = MySerializer;
```

Then set the farm options accordingly :

```js
const farm = workhorse.create({
    module: "/absolute/path/to/the/worker/module.js",
    serializerPath: "/absolute/path/to/MySerializer", // you can use require.resolve to get the absolute path
});
```

## Events

You can listen to events from a worker of from the farm directly. They both extends Node.js EventEmitter.
All those events are already being used by Workhose. You do not have to implement anything, it works out of the box.
I wanted to expose events to have the possibility to add logging but I'm sure they are other use-cases :)

### Farm

```js
farm.on(event, callback)
```

#### killed

When the farm is killed.

```js
farm.on("killed", () => {
    // ...
});
```

#### newWorker

When a new worker is created within the farm.

```js
farm.on("newWorker", (workerId, workerPid) => {
    // ...
});
```

#### workerMessage

When a worker is sending a message to the farm.
`data` looks like this :
```
{
    callId: number;
    res?: any;
    err?: Error;
    workerId: number;
}
```

```js
farm.on("workerMessage", (workerId, data) => {
    // ...
});
```

#### workerTTLExceeded

When a worker achieved is TTL limitation.

```js
farm.on("workerTTLExceeded", (workerId) => {
    // ...
});
```

#### workerDisconnect

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_disconnect)

```js
farm.on("workerDisconnect", (workerId) => {
    // ...
});
```

#### workerError

This might be interesting to listen. This is emitted when the worker process encounter an error that is not handled by your module.
See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_error)

```js
farm.on("workerError", (workerId, err) => {
    // ...
});
```

#### workerClose

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_close)

```js
farm.on("workerClose", (workerId, code, signal) => {
    // ...
});
```

#### workerExit

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_exit)

```js
farm.on("workerExit", (workerId, code, signal) => {
    // ...
});
```

#### workerKilled

Emitted when a worker is killed (after worker.kill() or farm.kill() or workhorse.kill())

```js
farm.on("workerKilled", (workerId) => {
    // ...
});
```

#### workerModuleLoaded

Emitted when a worker finished to load the module

```js
farm.on("workerModuleLoaded", (workerId) => {
    // ...
});
```

#### workerMaxIdleTime

Emitted when a worker has reached the max idle time limit

```js
farm.on("workerMaxIdleTime", (workerId) => {
    // ...
});
```

### Worker

```js
worker.on(event, callback)
```

#### message

When a worker is sending a message to the farm.

```js
worker.on("message", (data) => {
    // ...
});
```

#### TTLExceeded

When a worker achieved is TTL limitation.

```js
worker.on("TTLExceeded", () => {
    // ...
});
```

#### disconnect

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_disconnect)

```js
worker.on("disconnect", () => {
    // ...
});
```

#### error

This might be interesting to listen. This is emitted when the worker process encounter an error that is not handled by your module.
See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_error)

```js
worker.on("error", (err) => {
    // ...
});
```

#### close

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_close)

```js
worker.on("close", (code, signal) => {
    // ...
});
```

#### exit

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_exit)

```js
worker.on("exit", (code, signal) => {
    // ...
});
```

#### killed

Emitted when a worker is killed (after worker.kill() or farm.kill() or workhorse.kill())

```js
worker.on("killed", () => {
    // ...
});
```

#### moduleLoaded

Emitted when a worker finished to load the module

```js
worker.on("moduleLoaded", () => {
    // ...
});
```

#### maxIdleTime

Emitted when a worker has reached the max idle time limit

```js
worker.on("maxIdleTime", () => {
    // ...
});
```

## Debugging

You can enable debugging by using an environment variable : `DEBUG=workhorse:*`

## Why I created this ?

I was looking for a project to use TypeScript for the first time so the idea was to reproduce `node-worker-farm` and then add some new features. It actually went pretty smoothly and I'm happy with the result ;)

## License

Workhorse is Copyright (c) 2018 Hugo Da Roit ([@Yaty](https://github.com/Yaty)) and licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.
