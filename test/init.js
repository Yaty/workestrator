// Enable ts-node inside forked workers

if (!process.env["NYC_CWD"]) { // No need to do it when using NYC
    process.execArgv.push("-r", "ts-node/register");
}
