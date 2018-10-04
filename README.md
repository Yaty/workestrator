<a href="https://coveralls.io/github/Yaty/workestrator?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/Yaty/workestrator/badge.svg?branch=master" alt="Coverage Status" data-canonical-src="https://coveralls.io/github/Yaty/workestrator?branch=master" style="max-width:100%;"/></a>
<a href="https://travis-ci.org/Yaty/workestrator" target="_blank"><img src="https://travis-ci.org/Yaty/workestrator.svg?branch=master" alt="Build Status" data-canonical-src="https://travis-ci.org/Yaty/workestrator" style="max-width:100%;"/></a>
<a href="https://snyk.io/test/github/Yaty/workestrator" target="_blank"><img src="https://snyk.io/test/github/Yaty/workestrator/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/Yaty/workestrator" style="max-width:100%;"/></a>
<img src="https://img.shields.io/github/license/Yaty/workestrator.svg"/>

# Workestrator

[![Greenkeeper badge](https://badges.greenkeeper.io/Yaty/workestrator.svg)](https://greenkeeper.io/)

Workestrator is a library to distribute tasks to child processes. It is written in TypeScript and use ES2017 features.
This project is highly inspired by [`node-worker-farm`](https://github.com/rvagg/node-worker-farm) and add some new features.
Typescript Documentation : [https://yaty.github.io/workestrator/](https://yaty.github.io/workestrator/)

`npm install --save workestrator`

## Features

1. Concurrency options
2. Durability / Resilience : when a call fails it will be re-queued automatically (according to the farm options).
3. Async/Await support out of the box
4. Events
5. Serializers : You can choose among several serializers according to the data types you send to the workers. You can also write your own :)
6. Broadcasting

## Usage

```js
const workestrator = require("workestrator");

const farm = workestrator.create({
    module: "/absolute/path/to/the/worker/module.js",
});

try {
    await farm.run(1, 2, 3); // returns 6
    await farm.runMethod("foo", 1, 2, 3); // returns "bar:1:2:3"
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
    return `bar:${a}:${b}:${c}`;
};
```

## Examples

## Basic

[Running and broadcasting methods.](./examples/basic)

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

### Workestrator

#### workestrator.create(options)

Create a new farm.

```js
const workestrator = require("workestrator");

const farm = workestrator.create({
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
        execArgv: process.execArgv.filter((v) => !(/^--(debug|inspect)/).test(v)), // without debug and inspect
        execPath: process.execPath,
        silent: false,
    },
    killTimeout: 500,
    maxConcurrentCalls: Infinity,
    maxConcurrentCallsPerWorker: 10,
    maxIdleTime: Infinity,
    maxRetries: 3,
    numberOfWorkers: require("os").cpus().length,
    serializerPath: workestrator.serializers.JSON
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
- **`serializerPath`** : Absolute path to the serializer, Workestrator provides two serializers (JSON for basic data types, CBOR for complex data types). [See `Serializers` section.](#serializers)
- **`timeout`** : A call will have to finish under `timeout` ms. It will throw a TimeoutError. It will be retried according to the farm options.
- **`ttl`** : The amount of calls a worker can execute. The worker will be killed, his tasks will be redistributed to other workers. A new worker will be created.

#### workestrator.kill()

Kill all farms.

```js
workestrator.kill();
```

### Farm

#### farm.run(...args)

Run the default exported method in your module with arguments. Async.
Returns what's returned by the default method.

```js
try {
    const res = await farm.run(1, [], "");
    console.log("Result :", res);
} catch (err) {
    console.log("Oh no :'(", err);
}
```

#### farm.runMethod(method, ...args)

Run a specific method in your module. Async.
Returns what's returned by the method.

```js
try {
    // bar is a method exported with : module.exports.bar = function ...
    const res = await farm.runMethod("bar", 1, [], "");
    console.log("Result :", res);
} catch (err) {
    console.log("Oh no :'(", err);
}
```

#### farm.broadcast(...args)

Run the default exported method in every worker with arguments. Async.
Returns an array with the first element being the succeeded calls and the second element the failures.

```js
const [successes, failures] = await farm.broadcast(1, [], "");
console.log("Successes :", successes);
console.log("Failures :", failures);
```

#### farm.broadcastMethod(method, ...args)

Run a specific method in every worker. Async.
Returns an array with the first element being the succeeded calls and the second element the failures.

```js
// bar is a function exported with : module.exports.bar = function ...
const [successes, failures] = await farm.broadcastMethod("foo", 1, [], "");
console.log("Successes :", successes);
console.log("Failures :", failures);
```

#### farm.kill()

Kill the farm.

```js
farm.kill();
```

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
 const {Serializer} = require("workestrator");

class MySerializer extends Serializer {
    encode(data) {
        // do some encoding
        return encodedData;
    }

    decode(data) {
        // do some decoding
        return decodedData;
    }
}

module.exports = MySerializer;
```

Then set the farm options accordingly :

```js
const farm = workestrator.create({
    module: "/absolute/path/to/the/worker/module.js",
    serializerPath: "/absolute/path/to/MySerializer", // you can use require.resolve to get the absolute path
});
```

JSON serializer path is in `workestrator.serializers.JSON`.

CBOR serializer path is in `workestrator.serializers.CBOR`.

## Events

You can listen to events from a worker of from the farm directly. They both extends Node.js EventEmitter.
All those events are already being used by Workestrator. You do not have to implement anything, it works out of the box.
I wanted to expose events to have the possibility to add logging but I'm sure they are other use-cases :)

### Farm

```js
farm.on(event, callback)
```

#### online

When a new worker is created within the farm.

```js
farm.on("online", (worker) => {
    // ...
});
```

#### message

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
farm.on("message", (worker, data) => {
    // ...
});
```

#### disconnect

When a worker disconnect.
See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_disconnect)

```js
farm.on("disconnect", (worker) => {
    // ...
});
```

#### error

The `error` event is emitted whenever:
- The process could not be spawned, or
- The process could not be killed, or
- Sending a message to the child process failed.

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_error)

```js
farm.on("error", (worker, err) => {
    // ...
});
```

#### close

When a stdio streams of a worker have been closed.
See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_close)

```js
farm.on("close", (worker, code, signal) => {
    // ...
});
```

#### exit

See [Node.js documentation](https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_event_exit)

```js
farm.on("exit", (worker, code, signal) => {
    // ...
});
```

#### ttl

When `ttl` is reached.

```js
farm.on("ttl", (worker) => {
    // ...
});
```

#### idle

When `maxIdleTime` is reached.

```js
farm.on("idle", (worker) => {
    // ...
});
```

## Logging

You can enable logging by using an environment variable : `DEBUG=workestrator:*`

## Why I created this ?

I was looking for a project to use TypeScript, so the idea was to reproduce `node-worker-farm` and add some new features. It actually went pretty smoothly and I'm happy with the result ;)

## License

Workestrator is Copyright (c) 2018 Hugo Da Roit ([@Yaty](https://github.com/Yaty)) and licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.
