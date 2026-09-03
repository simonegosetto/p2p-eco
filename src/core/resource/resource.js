import {createHash} from 'node:crypto';

export const sha256 = payload => createHash('sha256').update(payload).digest('hex');

/**
 * "abstract" class: subclass it and implement sync() to bridge a real backend
 * (external service, database, ...).
 */
export default class Resource {
    name;
    values = [];
    hash;

    constructor(name, values) {
        this.name = name;
        this.values = values || [];
        this.updateHash();
    }

    /**
     * A getter, not a field: an assigned copy went stale the moment `values`
     * changed.
     *
     * @returns {number}
     */
    get rows() {
        return this.values.length;
    }

    /**
     * @returns {string} the recomputed hash
     */
    updateHash() {
        this.hash = sha256(JSON.stringify(this.values));
        return this.hash;
    }

    /**
     * Digest exchanged with the other nodes.
     *
     * @returns {{name: string, rows: number, hash: string}}
     */
    digest() {
        return {name: this.name, rows: this.rows, hash: this.hash};
    }

    /**
     * Hook for the custom function that talks to the external backend.
     */
    sync() {}
}
