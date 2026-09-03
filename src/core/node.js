import {randomBytes} from 'node:crypto';
import os from 'node:os';
import getPort from 'get-port';
import defaults from 'dat-swarm-defaults';
import Swarm from 'discovery-swarm';
import pkg from 'node-machine-id';

const {machineIdSync} = pkg;
import config from '../config.js';
import logger from './logger.js';
import Peer, {PROTOCOL_VERSION} from './peer.js';
import {createFrameDecoder} from './framing.js';
import ResourceManager from './resource/resource-manager.js';

const log = logger.child('node');

/**
 * Normalizes any peer identifier into a stable hex key.
 *
 * `discovery-swarm` hands out `info.id` as a Buffer, while our own node id is a
 * string: routing both through here is what makes the two comparable, and keeps
 * `#peers` keys printable instead of raw utf8 over random bytes.
 *
 * @param id Buffer, Uint8Array or string
 * @returns {string} hex key, '' when the id is missing
 */
export function toPeerKey(id) {
    if (id === undefined || id === null) return '';
    if (Buffer.isBuffer(id)) return id.toString('hex');
    if (id instanceof Uint8Array) return Buffer.from(id).toString('hex');
    return Buffer.from(String(id), 'utf8').toString('hex');
}

export default class Node {
    #channel = '';
    #nodeID;
    #peerKey;
    #port;
    #peers = {};
    #peerSeq = 0;
    #readyPromise;
    #destroyed = false;
    swarm;
    resourceManager;

    /**
     *
     * @param channel discovery topic to join
     * @param port listen port, auto-assigned when omitted
     * @param nodeID overrides the derived identifier
     */
    constructor(channel, port, nodeID = undefined) {
        this.#channel = channel;
        this.#nodeID = nodeID || machineIdSync() + randomBytes(4).toString('hex');
        this.#peerKey = toPeerKey(this.#nodeID);

        // built in the constructor body on purpose: as a class field it would
        // depend on the declaration order of #peers to work at all.
        this.resourceManager = new ResourceManager({
            broadcast: (type, data) => this.broadcast(type, data)
        });

        log.info(`arch: ${os.arch()} | platform: ${os.platform()} | cpus: ${os.cpus().length}`);

        this.#readyPromise = this.#initializeNode(port);
        // keeps an early failure from surfacing as an unhandled rejection;
        // ready() still rejects for whoever awaits it.
        this.#readyPromise.catch(() => {});
    }

    /**
     * Resolves once the swarm is listening and has joined the channel.
     *
     * @returns {Promise<Node>}
     */
    async ready() {
        await this.#readyPromise;
        return this;
    }

    get nodeID() {
        return this.#nodeID;
    }

    get port() {
        return this.#port;
    }

    /**
     * @returns {string[]}
     */
    getPeers() {
        return [...Object.keys(this.#peers)];
    }

    /**
     * Sends a framed message to a single peer.
     *
     * @param peerKey hex key as returned by getPeers()
     * @param type message kind
     * @param data payload
     * @returns {boolean} false when the peer is unknown
     */
    sendMessage(peerKey, type, data) {
        const peer = this.#peers[peerKey];
        if (!peer) {
            log.warn(`unknown peer ${peerKey}, message dropped`);
            return false;
        }
        peer.sendMessage(this.#nodeID, type, data);
        return true;
    }

    /**
     * Sends a framed message to every connected peer.
     *
     * @returns {number} how many peers were written to
     */
    broadcast(type, data) {
        const peers = Object.values(this.#peers);
        for (const peer of peers) {
            peer.sendMessage(this.#nodeID, type, data);
        }
        return peers.length;
    }

    /**
     * Leaves the channel, closes every peer and tears the swarm down.
     *
     * @returns {Promise<void>}
     */
    async destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;

        for (const key of Object.keys(this.#peers)) {
            const peer = this.#peers[key];
            delete this.#peers[key];
            peer.destroy();
        }

        if (!this.swarm) return;
        this.swarm.leave(this.#channel);
        await new Promise(resolve => this.swarm.destroy(resolve));
        log.info('swarm closed');
    }

    /**
     * @param port
     * @returns {Promise<void>}
     */
    async #initializeNode(port) {
        this.#port = port || await getPort();

        const swarmConfig = defaults({id: this.#nodeID, keepExistingConnections: true});
        this.swarm = Swarm(swarmConfig);

        await new Promise((resolve, reject) => {
            const onError = error => {
                this.swarm.removeListener('listening', onListening);
                reject(error);
            };
            const onListening = () => {
                this.swarm.removeListener('error', onError);
                resolve();
            };
            this.swarm.once('error', onError);
            this.swarm.once('listening', onListening);
            this.swarm.listen(this.#port);
        });

        // from here on a swarm error must not take the process down
        this.swarm.on('error', error => log.error(`swarm error: ${error.message}`));

        log.info(`node ${this.#nodeID} listening on port ${this.#port}`);

        this.swarm.on('connection', (conn, info) => this.#onConnection(conn, info));
        this.swarm.join(this.#channel);
        log.info(`joined channel ${this.#channel}`);
    }

    /**
     * @param conn duplex stream
     * @param info peer metadata from discovery-swarm
     */
    #onConnection(conn, info) {
        const peerKey = toPeerKey(info?.id);

        if (!peerKey || peerKey === this.#peerKey) {
            log.debug('dropping connection to self');
            conn.destroy();
            return;
        }

        const peer = new Peer(peerKey, conn, ++this.#peerSeq);
        this.#addPeer(peer);
        log.info(`connected to (${peer.index}) ${peerKey}`);

        // the accumulation buffer is per-socket state: one decoder per peer
        const decode = createFrameDecoder(
            message => this.#onMessage(peerKey, message),
            {
                maxFrameBytes: config.maxFrameBytes,
                onError: error => {
                    log.error(`framing error from ${peerKey}: ${error.message}`);
                    conn.destroy();
                }
            }
        );

        conn.on('data', decode);
        conn.on('error', error => log.warn(`connection error with ${peerKey}: ${error.message}`));
        conn.on('close', () => this.#removePeer(peerKey, peer));
    }

    /**
     * @param peerKey
     * @param message decoded envelope
     */
    #onMessage(peerKey, message) {
        if (message?.v !== PROTOCOL_VERSION) {
            log.warn(`unsupported protocol version ${message?.v} from ${peerKey}, ignored`);
            return;
        }
        // TODO dispatch on message.type once the sync protocol exists (issue #2)
        log.debug(`(${message.from}) ${message.type}: ${JSON.stringify(message.data)}`);
    }

    /**
     * Registers a peer, replacing any previous connection to the same node.
     *
     * @param peer
     */
    #addPeer(peer) {
        if (!peer?.id) return;

        const existing = this.#peers[peer.id];
        if (existing) {
            log.warn(`peer ${peer.id} reconnected, closing the stale connection`);
            // dropped before destroy(): its 'close' handler then finds a
            // different peer registered and leaves the new one alone.
            delete this.#peers[peer.id];
            existing.destroy();
        }

        this.#peers[peer.id] = peer;
        this.#logPeers();
    }

    /**
     * Removes a peer only if it is still the registered one.
     *
     * @param peerKey
     * @param peer the instance whose connection closed
     */
    #removePeer(peerKey, peer) {
        if (this.#peers[peerKey] !== peer) return;
        delete this.#peers[peerKey];
        log.info(`connection to ${peerKey} closed`);
        this.#logPeers();
    }

    /**
     *
     */
    #logPeers() {
        if (!log.isEnabled('debug')) return;
        console.table(Object.keys(this.#peers));
    }
}
