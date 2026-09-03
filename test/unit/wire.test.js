import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import Peer, {PROTOCOL_VERSION} from '../../src/core/peer.js';
import {createFrameDecoder} from '../../src/core/framing.js';

/**
 * Send/receive path over a real stream, with no discovery involved: the Dat
 * swarm cannot hold a stable connection (see the Roadmap note in the README),
 * so the wire contract is pinned down here instead of in the integration suite.
 */
const wire = () => {
    const socket = new PassThrough();
    const received = [];
    const peer = new Peer('deadbeef', socket, 1);
    socket.on('data', createFrameDecoder(message => received.push(message)));
    return {peer, received, socket};
};

test('a sent envelope arrives decoded on the other side', async () => {
    const {peer, received} = wire();

    peer.sendMessage('node-a', 'resource-digest', [{name: 'users', rows: 13, hash: 'abc'}]);
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(received, [{
        v: PROTOCOL_VERSION,
        type: 'resource-digest',
        from: 'node-a',
        data: [{name: 'users', rows: 13, hash: 'abc'}]
    }]);
});

test('back-to-back messages stay separate on the wire', async () => {
    const {peer, received} = wire();

    peer.sendMessage('node-a', 'hello', {n: 1});
    peer.sendMessage('node-a', 'hello', {n: 2});
    peer.sendMessage('node-a', 'hello', {n: 3});
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(received.map(m => m.data.n), [1, 2, 3]);
});

test('a payload larger than one chunk survives the crossing', async () => {
    const {peer, received} = wire();
    const values = Array.from({length: 20_000}, (_, i) => `row-${i}`);

    peer.sendMessage('node-a', 'resource-digest', values);
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(received.length, 1);
    assert.equal(received[0].data.length, 20_000);
    assert.equal(received[0].data.at(-1), 'row-19999');
});

test('destroy closes the underlying connection', () => {
    const {peer, socket} = wire();

    peer.destroy();

    assert.equal(socket.destroyed, true);
});
