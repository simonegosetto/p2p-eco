import config from './config.js';
import logger from './core/logger.js';
import Node from './core/node.js';
import Resource from './core/resource/resource.js';

const log = logger.child('main');

let checkTimer;
let shuttingDown = false;

const node = new Node(config.channel, config.port, config.nodeID);

const shutdown = async signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down`);
    clearInterval(checkTimer);

    try {
        await node.destroy();
    } catch (error) {
        log.error(`shutdown failed: ${error.message}`);
        process.exitCode = 1;
    }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => void shutdown(signal));
}

// A broken process must die so the supervisor (PM2) can restart it: logging and
// carrying on leaves an inconsistent node connected to the swarm.
process.on('uncaughtException', error => {
    log.error('uncaught exception', error);
    process.exit(1);
});

process.on('unhandledRejection', reason => {
    log.error('unhandled rejection', reason);
    process.exit(1);
});

try {
    await node.ready();
} catch (error) {
    log.error(`node failed to start: ${error.message}`);
    process.exit(1);
}

// demo resource: replace with a Resource subclass wired to a real backend
node.resourceManager.addResource(new Resource('users', Date.now().toString().split('')));

checkTimer = setInterval(() => node.resourceManager.check(), config.checkIntervalMs);
