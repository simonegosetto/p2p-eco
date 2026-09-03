import test from 'node:test';
import assert from 'node:assert/strict';
import {toPeerKey} from '../../src/core/node.js';

test('hex-encodes a Buffer id', () => {
    assert.equal(toPeerKey(Buffer.from('abc')), '616263');
});

test('hex-encodes a Uint8Array id', () => {
    assert.equal(toPeerKey(new Uint8Array([0xde, 0xad])), 'dead');
});

test('hex-encodes a string id', () => {
    assert.equal(toPeerKey('abc'), '616263');
});

test('maps a Buffer and the string it holds onto the same key', () => {
    // this is what makes the self-connection filter work: discovery-swarm hands
    // back info.id as a Buffer, while our own node id is a string
    const nodeID = 'machine-id-deadbeef';

    assert.equal(toPeerKey(Buffer.from(nodeID, 'utf8')), toPeerKey(nodeID));
});

test('never produces the raw utf8 coercion used as an object key before', () => {
    const key = toPeerKey(Buffer.from([0x00, 0xff, 0x10]));

    assert.equal(key, '00ff10');
    assert.match(key, /^[0-9a-f]*$/);
});

test('returns an empty key for a missing id', () => {
    assert.equal(toPeerKey(undefined), '');
    assert.equal(toPeerKey(null), '');
});
