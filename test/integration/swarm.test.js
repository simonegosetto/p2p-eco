import test from 'node:test';
import assert from 'node:assert/strict';
import Node from '../../src/core/node.js';
import {setLevel} from '../../src/core/logger.js';

setLevel('silent');

/**
 * These tests need real discovery (mDNS or the DHT), so they are kept out of
 * `npm test`: run them with `npm run test:integration`. They will not pass in a
 * sandbox with no multicast and no outbound UDP.
 *
 * Known limitation of the transport, not of this code: `discovery-swarm` does
 * not hold the link up. Two peers reconnect and drop each other roughly once a
 * second, which reproduces identically with the bare library and no code of
 * ours in the path. The peering assertion below therefore samples a window in
 * which the link happens to be up. The wire contract itself is pinned down
 * deterministically in test/unit/wire.test.js; fixing the flap means changing
 * transport (see the Roadmap in the README).
 */

const waitFor = async (predicate, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
};

test('a node starts, listens and tears itself down', {timeout: 30_000}, async () => {
    const node = await new Node(`p2p-eco-solo-${Date.now()}`, undefined, 'node-solo').ready();

    assert.ok(node.port > 0);
    assert.deepEqual(node.getPeers(), []);

    await node.destroy();
    await node.destroy(); // idempotent
});

test('two nodes on the same channel connect and exchange a digest', {timeout: 60_000}, async () => {
    const channel = `p2p-eco-pair-${Date.now()}`;
    const a = await new Node(channel, undefined, 'node-a').ready();
    const b = await new Node(channel, undefined, 'node-b').ready();

    try {
        const connected = await waitFor(() => a.getPeers().length > 0 && b.getPeers().length > 0, 45_000);
        assert.ok(connected, 'the two nodes never discovered each other');

        assert.equal(a.getPeers().length, 1);
        assert.equal(b.getPeers().length, 1);
        assert.deepEqual(a.getPeers(), [Buffer.from('node-b').toString('hex')]);

        // neither node may ever register itself as a peer
        assert.equal(a.getPeers().includes(Buffer.from('node-a').toString('hex')), false);

        assert.equal(a.broadcast('hello', {ping: true}), 1);
    } finally {
        await a.destroy();
        await b.destroy();
    }
});
