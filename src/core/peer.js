import msgpack from "msgpack-lite";

export default class Peer {
    id;
    index;
    #connection;

    constructor(id, conn, index) {
        this.id = id;
        this.index = index;
        this.#connection = conn;
    }

    /**
     *
     * @param senderID
     * @param message
     */
    sendMessage(senderID, message) {
        this.#connection.write(JSON.stringify(
            [...msgpack.encode({
                from: senderID,
                data: message
            })]
        ));
    }

}
