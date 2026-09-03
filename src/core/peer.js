import {encodeFrame} from './framing.js';

export const PROTOCOL_VERSION = 1;

export default class Peer {
    id;
    index;
    #connection;

    /**
     *
     * @param id normalized peer key (hex)
     * @param conn duplex stream towards the peer
     * @param index local, monotonic display index
     */
    constructor(id, conn, index) {
        this.id = id;
        this.index = index;
        this.#connection = conn;
    }

    /**
     * Writes one framed envelope on the wire.
     *
     * @param senderID id of the sending node
     * @param type message kind, e.g. 'hello' or 'resource-digest'
     * @param data payload
     */
    sendMessage(senderID, type, data) {
        this.#connection.write(encodeFrame({
            v: PROTOCOL_VERSION,
            type,
            from: senderID,
            data
        }));
    }

    /**
     * Closes the underlying connection.
     */
    destroy() {
        this.#connection.destroy();
    }
}
