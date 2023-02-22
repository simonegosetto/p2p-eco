import Resource from "./core/resource/resource.js";

console.clear();

import Node from './core/node.js'

const node = new Node('SyncChannel');

(async () => {

    node.resourceManager.addResource(new Resource('users', new Date().getTime().toString().split('')))
    // node.archiveManager.addArchive(new Archive('roles', [1, 2, 3, 4]))

    setInterval(() => {
        node.resourceManager.check();
    }, 5000);

})();

process.on('uncaughtException', err => console.log('ERROR ::', err));
