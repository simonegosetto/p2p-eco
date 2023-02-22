import {randomBytes} from "crypto";
import getPort from "get-port";
import defaults from "dat-swarm-defaults";
import Swarm from "discovery-swarm";
import pkg from 'node-machine-id';
import os from 'os';

const {machineIdSync} = pkg;
import Peer from './peer.js'
import msgpack from 'msgpack-lite';
import ResourceManager from "./resource/resource-manager.js";

export default class Node {
    #channel = '';
    #nodeID;
    #port;
    #peers = {};
    swarm;
    resourceManager = new ResourceManager(this.#peers);

    /**
     *
     * @param channel
     * @param nodeID
     * @param port
     * @returns {Promise<void>}
     */
    constructor(channel, port, nodeID = undefined) {
        this.#channel = channel;
        this.#nodeID = nodeID || machineIdSync() + randomBytes(4).toString('hex');
        this.#initializeNode(port).then();
        console.log(`ARCH: ${os.arch()}`)
        console.log(`PLATFORM: ${os.platform()}`)
        console.log(`CPU: ${os.cpus().length}`)
    }

    /**
     *
     * @param port
     * @returns {Promise<void>}
     */
    async #initializeNode(port) {
        try {
            this.#port = port || await getPort();

            // init network swarm
            const config = defaults({id: this.#nodeID, keepExistingConnections: true});
            this.swarm = Swarm(config);
            this.swarm.listen(this.#port);

            console.log(`Current Node: ${this.#nodeID.toString('hex')}`);
            console.log(`Listen Port: ${this.#port}`);

            this.swarm.join(this.#channel);

            // connection with other node event
            this.swarm.on('connection', (conn, info) => {

                const index = Object.keys(this.#peers).length + 1;
                const peerID = info.id; // .toString('hex');
                this.addPeer(new Peer(peerID, conn, index));

                console.log(`Connection to (${index}) ${peerID}`);

                // this.sendMessage(peerID, 'benvenuto!');

                conn.on('data', data => {
                    // console.log('data', data);
                    const message = msgpack.decode(JSON.parse(data));
                    console.log(`(${message.from}): ${JSON.stringify(message.data)}`);
                });

                conn.on('close', () => {
                    console.log(`close connection to peer ${peerID}`);
                    this.removePeer(peerID);
                });
            })

        } catch (e) {
            // EADDRINUSE
            console.log(e);
        }
    }

    /**
     *
     * @returns {string[]}
     */
    getPeers() {
        return [...Object.keys(this.#peers)];
    }

    /**
     *
     * @param peer
     */
    addPeer(peer) {
        if (peer && peer?.id) {
            this.#peers[peer.id] = peer;
        }
        this.#logPeers()
    }

    /**
     *
     * @param peerID
     */
    removePeer(peerID) {
        if (this.#peers[peerID]) {
            delete this.#peers[peerID];
        }
        this.#logPeers()
    }

    /**
     *
     * @param peerID
     * @param message
     */
    sendMessage(peerID, message) {
        this.#peers[peerID].sendMessage(this.#nodeID, message);
    }

    /**
     *
     */
    #logPeers() {
        console.table(Object.keys(this.#peers));
    }
}
