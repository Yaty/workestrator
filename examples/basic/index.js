const FARM_OPTIONS = {
    numberOfWorkers: require('os').cpus().length,
    module: require.resolve('./worker'),
};

const workestrator = require('../../dist');
const farm = workestrator.create(FARM_OPTIONS);

(async () => {
    try {
        await farm.broadcastMethod('init');
        console.log(await farm.run());
    } catch (err) {
        console.log(err);
    } finally {
        process.exit(0);
    }
})();