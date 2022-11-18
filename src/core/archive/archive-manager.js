import Archive from './archive.js';

export default class ArchiveManager {
    #archives = [];
    #peers = {}

    constructor(peers) {
        this.#peers = peers;
    }

    /**
     *
     * @param archive
     */
    addArchive(archive) {
        if (!(archive instanceof Archive)) {
            console.error(`invalid archive`);
            return;
        }

        if (this.#archives.map(n => n.name).includes(archive.name)) {
            console.error(`archive ${archive?.name} already exists`);
            return;
        }

        this.#archives.push(archive);
    }

    /**
     *
     */
    #logArchives() {
        console.table(this.#archives);
    }

    /**
     *
     */
    check() {
        if (this.#archives.length > 0) {
            // TODO capire come implementare l'algoritmo di sincronizzazione
            /*for (const archive of this.#archives) {
                Object.keys(this.#peers).forEach(peer => {
                    this.#peers[peer].sendMessage('antani', {name: archive.name, hash: archive.hash});
                })
            }*/
        } else {
            console.info('no archives presents')
        }
    }

}
