import Farm from "../lib/Farm";

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