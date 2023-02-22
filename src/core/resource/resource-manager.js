import Resource from './resource.js';

export default class ResourceManager {
    #resources = [];
    #peers = {}

    constructor(peers) {
        this.#peers = peers;
    }

    /**
     *
     * @param resource
     */
    addResource(resource) {
        if (!(resource instanceof Resource)) {
            console.error(`invalid resource`);
            return;
        }

        if (this.#resources.map(n => n.name).includes(resource.name)) {
            console.error(`resource ${resource?.name} already exists`);
            return;
        }

        this.#resources.push(resource);
    }

    /**
     *
     */
    #logResources() {
        console.table(this.#resources);
    }

    /**
     *
     */
    check() {
        if (this.#resources.length > 0) {
            // TODO capire come implementare l'algoritmo di sincronizzazione
            /*for (const archive of this.#archives) {
                Object.keys(this.#peers).forEach(peer => {
                    this.#peers[peer].sendMessage('antani', {name: archive.name, hash: archive.hash});
                })
            }*/
        } else {
            console.info('no resources presents')
        }
    }

}
