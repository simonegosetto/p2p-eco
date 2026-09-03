import Resource from './resource.js';
import logger from '../logger.js';

const log = logger.child('resources');

export default class ResourceManager {
    #resources = new Map();
    #broadcast;

    /**
     * @param broadcast sends a message to every connected peer
     */
    constructor({broadcast} = {}) {
        this.#broadcast = typeof broadcast === 'function' ? broadcast : () => 0;
    }

    /**
     * @returns {number}
     */
    get size() {
        return this.#resources.size;
    }

    /**
     * @returns {Resource[]}
     */
    getResources() {
        return [...this.#resources.values()];
    }

    /**
     * @param name
     * @returns {Resource|undefined}
     */
    getResource(name) {
        return this.#resources.get(name);
    }

    /**
     * @param resource
     * @returns {boolean} false when rejected
     */
    addResource(resource) {
        if (!(resource instanceof Resource)) {
            log.error('invalid resource, ignored');
            return false;
        }

        if (this.#resources.has(resource.name)) {
            log.error(`resource ${resource.name} already exists`);
            return false;
        }

        this.#resources.set(resource.name, resource);
        log.info(`resource ${resource.name} registered (${resource.rows} rows, hash ${resource.hash.slice(0, 12)})`);
        return true;
    }

    /**
     * One anti-entropy round: announces the local digests to the other nodes.
     *
     * Announcing is the easy half. Reconciling is not implemented, and cannot
     * be until the model gains a versioning primitive: the hash detects that
     * two replicas diverged but says nothing about which one is newer (no
     * logical clock, no CRDT). See issue #2 and the Roadmap in the README.
     *
     * @returns {number} peers the digest was sent to
     */
    check() {
        if (this.#resources.size === 0) {
            log.debug('no resources registered');
            return 0;
        }

        const digests = this.getResources().map(resource => resource.digest());
        const reached = this.#broadcast('resource-digest', digests);
        log.debug(`digest of ${digests.length} resource(s) sent to ${reached} peer(s); reconciliation still a TODO`);
        return reached;
    }
}
