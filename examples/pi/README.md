# Approximating π

## Start the example

`node examples/pi`

```
Doing it the slow (single-process) way...
π ≈ 3.141553112000002 	(0.0000395415897909146 away from actual!)
took 36952 milliseconds
Doing it the fast (multi-process) way...
π ≈ 3.1417294239999984 	(0.00013677041020532243 away from actual!)
took 13100 milliseconds
```

On my machine I have 4 cores, so in the example it is using 4 workers.
So it's kind of logical that we approximate π around 3 times faster (2.82 actually).

## How it works ?

To see some logs set DEBUG in your environment variables to `workhorse:*`

### Initialisation

As I have 4 cores on my machine there will be 4 workers in the farm (according to `numberOfWorkers: require('os').cpus().length`).

```
workhorse:farm:0 Creating worker 1 of 4. +0ms
workhorse:farm:0:worker:0 Worker ignited. +0ms
workhorse:farm:0:worker:0 Worker is listening. +0ms
workhorse:farm:0 Worker 1 (id: 0) created. +24ms

workhorse:farm:0 Creating worker 2 of 4. +0ms
workhorse:farm:0:worker:1 Worker ignited. +0ms
workhorse:farm:0:worker:1 Worker is listening. +0ms
workhorse:farm:0 Worker 2 (id: 1) created. +17ms

workhorse:farm:0 Creating worker 3 of 4. +0ms
workhorse:farm:0:worker:2 Worker ignited. +0ms
workhorse:farm:0:worker:2 Worker is listening. +0ms
workhorse:farm:0 Worker 3 (id: 2) created. +24ms

workhorse:farm:0 Creating worker 4 of 4. +0ms
workhorse:farm:0:worker:3 Worker ignited. +0ms
workhorse:farm:0:worker:3 Worker is listening. +0ms
workhorse:farm:0 Worker 4 (id: 3) created. +20ms

workhorse:farm:0 Workers ignited. +0ms
workhorse:main Farm created 0. +0ms
```

### Filling the queue for the first time

As we have `maxConcurrentCallsPerWorker : 1` there will be 4 calls sent to the 4 workers.

```
workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +40s
workhorse:farm:0:worker:0 Run call : { args: [ 1000000 ], callId: 0, method: undefined, workerId: 0 } +40s
workhorse:farm:0 Call 0 sent to worker successfully 0. +2ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0:worker:1 Run call : { args: [ 1000000 ], callId: 1, method: undefined, workerId: 1 } +40s
workhorse:farm:0 Call 1 sent to worker successfully 1. +10ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0:worker:2 Run call : { args: [ 1000000 ], callId: 2, method: undefined, workerId: 2 } +40s
workhorse:farm:0 Call 2 sent to worker successfully 2. +0ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0:worker:3 Run call : { args: [ 1000000 ], callId: 3, method: undefined, workerId: 3 } +40s
workhorse:farm:0 Call 3 sent to worker successfully 3. +6ms
```

### Dispatching

Since our workers are busy our calls will be put in the queue and not call right away
The re-queued call will always be the first to be processed once a worker is ready. 

```
workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

workhorse:farm:0 Dispatch { args: [ 1000000 ], timeout: Infinity } +0ms
workhorse:farm:0 Call 4 not taken by workers for this time. Retrying later. +0ms

...
```

### Workers are starting to respond!

Every time a worker is available a call from the queue is sent to this worker.
Here as we have `maxConcurrentCallsPerWorker : 1`, every time a worker has finished to approximate π a new call is sent to this worker.

```
...
workhorse:farm:0:worker:1 Worker message event { callId: 1, res: 3.142312 } +129ms
workhorse:farm:0 Receive data : { callId: 1, res: 3.142312 } +7ms
workhorse:farm:0:worker:1 Run call : { args: [ 1000000 ], callId: 4, method: undefined, workerId: 1 } +0ms
workhorse:farm:0 Call 4 sent to worker successfully 1. +0ms

workhorse:farm:0:worker:2 Worker message event { callId: 2, res: 3.138932 } +126ms
workhorse:farm:0 Receive data : { callId: 2, res: 3.138932 } +7ms
workhorse:farm:0:worker:2 Run call : { args: [ 1000000 ], callId: 5, method: undefined, workerId: 2 } +0ms
workhorse:farm:0 Call 5 sent to worker successfully 2. +7ms

workhorse:farm:0:worker:0 Worker message event { callId: 0, res: 3.141068 } +143ms
workhorse:farm:0 Receive data : { callId: 0, res: 3.141068 } +0ms
workhorse:farm:0:worker:0 Run call : { args: [ 1000000 ], callId: 6, method: undefined, workerId: 0 } +0ms
workhorse:farm:0 Call 6 sent to worker successfully 0. +0ms

workhorse:farm:0:worker:3 Worker message event { callId: 3, res: 3.142852 } +134ms
workhorse:farm:0 Receive data : { callId: 3, res: 3.142852 } +1ms
workhorse:farm:0:worker:3 Run call : { args: [ 1000000 ], callId: 7, method: undefined, workerId: 3 } +0ms
workhorse:farm:0 Call 7 sent to worker successfully 3. +0ms
...
```

### The end

```
...
workhorse:farm:0:worker:2 Worker message event { callId: 497, res: 3.144488 } +90ms
workhorse:farm:0 Receive data : { callId: 497, res: 3.144488 } +74ms
workhorse:farm:0 No call in queue. +0ms

workhorse:farm:0:worker:3 Worker message event { callId: 498, res: 3.143072 } +87ms
workhorse:farm:0 Receive data : { callId: 498, res: 3.143072 } +8ms
workhorse:farm:0 No call in queue. +0ms

workhorse:farm:0:worker:0 Worker message event { callId: 496, res: 3.137716 } +112ms
workhorse:farm:0 Receive data : { callId: 496, res: 3.137716 } +12ms
workhorse:farm:0 No call in queue. +0ms

workhorse:farm:0:worker:1 Worker message event { callId: 499, res: 3.140636 } +115ms
workhorse:farm:0 Receive data : { callId: 499, res: 3.140636 } +21ms
workhorse:farm:0 No call in queue. +0ms

π ≈ 3.141674495999999 	(0.0000818424102058124 away from actual!)
took 12869 milliseconds
``̀