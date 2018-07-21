import Farm from "../lib/Farm";
import Worker from "../lib/worker/Worker";

export function waitForWorkersToLoad(farm: Farm) {
    return new Promise((resolve) => {
        const itv = setInterval(() => {
            const readyWorkers = farm.workers.reduce((acc, w) => acc + Number(w.isAvailable()), 0);

            if (readyWorkers === farm.workers.length) {
                clearInterval(itv);
                resolve();
            }
        }, 50);
    });
}

export function waitForWorkerToLoad(worker: Worker) {
    return new Promise((resolve) => {
        if (worker.isAvailable()) {
            return resolve();
        }

        const itv = setInterval(() => {
            if (worker.isAvailable()) {
                clearInterval(itv);
                resolve();
            }
        }, 50);
    });
}
