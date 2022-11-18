console.clear();

import Node from './core/node.js'
import Archive from "./core/archive/archive.js";

const node = new Node('SyncChannel');

(async () => {

    node.archiveManager.addArchive(new Archive('users', new Date().getTime().toString().split('')))
    // node.archiveManager.addArchive(new Archive('roles', [1, 2, 3, 4]))

    setInterval(() => {
        node.archiveManager.check();
    }, 5000);

})();

process.on('uncaughtException', err => console.log('ERROR ::', err));
