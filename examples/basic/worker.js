module.exports = function() {
    return `Hello world from ${process.pid}`;
};

module.exports.init = function() {
    console.log(`Worker ${process.pid} ignited.`);
};