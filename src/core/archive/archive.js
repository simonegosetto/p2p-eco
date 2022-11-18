import crypto from 'crypto';

// "abstract" class
export default class Archive {
    name;
    rows;
    hash;
    values = [];
    SHA256 = payload => crypto.createHash('sha256').update(payload).digest('hex');

    constructor(name, values) {
        this.name = name;
        this.values = values || [];
        this.rows = this.values.length;
        this.updateHash();
    }

    updateHash() {
        this.hash = this.SHA256(JSON.stringify(this.values));
    }

    sync() {}
}
