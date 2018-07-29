# Approximating π

## Start the example

`node examples/pi`

```
Doing it the slow (single-process) way...
π ≈ 3.141597687999999   (0.000005034410206050666 away from actual!)
took 12217 milliseconds
Doing it the fast (multi-process) way...
π ≈ 3.1415487919999996  (0.000043861589793525724 away from actual!)
took 3425 milliseconds
```

## How it works ?

To see some logs set DEBUG in your environment variables to `workestrator:*`

### Initialisation

As I have 4 cores on my machine there will be 4 workers in the farm (according to `numberOfWorkers: require('os').cpus().length`).

```
workestrator:farm:0 Creating worker 1 of 4. +0ms
workestrator:farm:0:worker:0 Worker ignited. +0ms
workestrator:farm:0:worker:0 Worker is listening. +0ms
workestrator:farm:0 Worker 1 (id: 0) created. +24ms

workestrator:farm:0 Creating worker 2 of 4. +0ms
workestrator:farm:0:worker:1 Worker ignited. +0ms
workestrator:farm:0:worker:1 Worker is listening. +0ms
workestrator:farm:0 Worker 2 (id: 1) created. +17ms

workestrator:farm:0 Creating worker 3 of 4. +0ms
workestrator:farm:0:worker:2 Worker ignited. +0ms
workestrator:farm:0:worker:2 Worker is listening. +0ms
workestrator:farm:0 Worker 3 (id: 2) created. +24ms

workestrator:farm:0 Creating worker 4 of 4. +0ms
workestrator:farm:0:worker:3 Worker ignited. +0ms
workestrator:farm:0:worker:3 Worker is listening. +0ms
workestrator:farm:0 Worker 4 (id: 3) created. +20ms

workestrator:farm:0 Workers ignited. +0ms
workestrator:main Farm created 0. +0ms
```

### Filling the queue for the first time

As we have `maxConcurrentCallsPerWorker : 1` there will be 4 calls sent to the 4 workers.

```
workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +40s
workestrator:farm:0:worker:0 Run call : { args: [ 1000000 ], callId: 0, method: undefined, workerId: 0 } +40s
workestrator:farm:0 Call 0 sent to worker successfully 0. +2ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0:worker:1 Run call : { args: [ 1000000 ], callId: 1, method: undefined, workerId: 1 } +40s
workestrator:farm:0 Call 1 sent to worker successfully 1. +10ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0:worker:2 Run call : { args: [ 1000000 ], callId: 2, method: undefined, workerId: 2 } +40s
workestrator:farm:0 Call 2 sent to worker successfully 2. +0ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0:worker:3 Run call : { args: [ 1000000 ], callId: 3, method: undefined, workerId: 3 } +40s
workestrator:farm:0 Call 3 sent to worker successfully 3. +6ms
```

### Dispatching

Since our workers are busy our calls will be put in the queue and not call right away
The re-queued call will always be the first to be processed once a worker is ready. 

```
workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workestrator:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workestrator:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

...
```

### Workers are starting to respond!

Every time a worker is available a call from the queue is sent to this worker.
Here as we have `maxConcurrentCallsPerWorker : 1`, every time a worker has finished to approximate π a new call is sent to this worker.

```
...
workestrator:farm:0:worker:1 Worker message event { callId: 1, res: 3.142312 } +129ms
workestrator:farm:0 Receive data : { callId: 1, res: 3.142312 } +7ms
workestrator:farm:0:worker:1 Run call : { args: [ 1000000 ], callId: 4, method: undefined, workerId: 1 } +0ms
workestrator:farm:0 Call 4 sent to worker successfully 1. +0ms

workestrator:farm:0:worker:2 Worker message event { callId: 2, res: 3.138932 } +126ms
workestrator:farm:0 Receive data : { callId: 2, res: 3.138932 } +7ms
workestrator:farm:0:worker:2 Run call : { args: [ 1000000 ], callId: 5, method: undefined, workerId: 2 } +0ms
workestrator:farm:0 Call 5 sent to worker successfully 2. +7ms

workestrator:farm:0:worker:0 Worker message event { callId: 0, res: 3.141068 } +143ms
workestrator:farm:0 Receive data : { callId: 0, res: 3.141068 } +0ms
workestrator:farm:0:worker:0 Run call : { args: [ 1000000 ], callId: 6, method: undefined, workerId: 0 } +0ms
workestrator:farm:0 Call 6 sent to worker successfully 0. +0ms

workestrator:farm:0:worker:3 Worker message event { callId: 3, res: 3.142852 } +134ms
workestrator:farm:0 Receive data : { callId: 3, res: 3.142852 } +1ms
workestrator:farm:0:worker:3 Run call : { args: [ 1000000 ], callId: 7, method: undefined, workerId: 3 } +0ms
workestrator:farm:0 Call 7 sent to worker successfully 3. +0ms
...
```

### The end

```
...
workestrator:farm:0:worker:2 Worker message event { callId: 497, res: 3.144488 } +90ms
workestrator:farm:0 Receive data : { callId: 497, res: 3.144488 } +74ms
workestrator:farm:0 No call in queue. +0ms

workestrator:farm:0:worker:3 Worker message event { callId: 498, res: 3.143072 } +87ms
workestrator:farm:0 Receive data : { callId: 498, res: 3.143072 } +8ms
workestrator:farm:0 No call in queue. +0ms

workestrator:farm:0:worker:0 Worker message event { callId: 496, res: 3.137716 } +112ms
workestrator:farm:0 Receive data : { callId: 496, res: 3.137716 } +12ms
workestrator:farm:0 No call in queue. +0ms

workestrator:farm:0:worker:1 Worker message event { callId: 499, res: 3.140636 } +115ms
workestrator:farm:0 Receive data : { callId: 499, res: 3.140636 } +21ms
workestrator:farm:0 No call in queue. +0ms

π ≈ 3.1415487919999996  (0.000043861589793525724 away from actual!)
took 3425 milliseconds
``̀
