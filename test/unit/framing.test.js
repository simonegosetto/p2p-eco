import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameDecoder, encodeFrame, HEADER_BYTES} from '../../src/core/framing.js';

const collector = options => {
    const messages = [];
    const errors = [];
    const push = createFrameDecoder(message => messages.push(message), {onError: e => errors.push(e), ...options});
    return {messages, errors, push};
};

const header = size => {
    const buffer = Buffer.allocUnsafe(HEADER_BYTES);
    buffer.writeUInt32BE(size, 0);
    return buffer;
};

test('encodeFrame prefixes the body with its size', () => {
    const frame = encodeFrame({hello: 'world'});
    assert.equal(frame.readUInt32BE(0), frame.length - HEADER_BYTES);
});

test('round-trips an envelope', () => {
    const {messages, push} = collector();
    const envelope = {v: 1, type: 'hello', from: 'node-a', data: [1, 2, 3]};

    push(encodeFrame(envelope));

    assert.deepEqual(messages, [envelope]);
});

test('reassembles a frame delivered one byte at a time', () => {
    // the case that made the old JSON.parse(data) throw
    const {messages, push} = collector();
    const frame = encodeFrame({type: 'resource-digest', data: {name: 'users', rows: 13}});

    for (const byte of frame) push(Buffer.from([byte]));

    assert.equal(messages.length, 1);
    assert.equal(messages[0].data.rows, 13);
});

test('splits two frames coalesced into one chunk', () => {
    const {messages, push} = collector();

    push(Buffer.concat([encodeFrame({n: 1}), encodeFrame({n: 2})]));

    assert.deepEqual(messages.map(m => m.n), [1, 2]);
});

test('holds a partial trailing frame until the rest arrives', () => {
    const {messages, push} = collector();
    const second = encodeFrame({n: 2});

    push(Buffer.concat([encodeFrame({n: 1}), second.subarray(0, 3)]));
    assert.deepEqual(messages.map(m => m.n), [1]);

    push(second.subarray(3));
    assert.deepEqual(messages.map(m => m.n), [1, 2]);
});

test('accepts a string chunk', () => {
    const {messages, push} = collector();

    push(encodeFrame({n: 1}).toString('latin1'));

    assert.deepEqual(messages.map(m => m.n), [1]);
});

test('round-trips an empty payload', () => {
    const {messages, push} = collector();

    push(encodeFrame({}));

    assert.deepEqual(messages, [{}]);
});

test('refuses an oversized frame and stays shut', () => {
    const {messages, errors, push} = collector({maxFrameBytes: 16});

    push(header(1024));

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /over the 16 bytes limit/);

    // unresynchronizable: no further frame may be trusted
    push(encodeFrame({n: 1}));
    assert.deepEqual(messages, []);
});

test('reports a malformed body but keeps draining the buffer', () => {
    const {messages, errors, push} = collector();
    const truncated = Buffer.from([0x81]); // fixmap announcing a pair that is not there

    push(Buffer.concat([header(truncated.length), truncated, encodeFrame({n: 7})]));

    assert.equal(errors.length, 1);
    assert.deepEqual(messages.map(m => m.n), [7]);
});

test('throws when no onError is provided', () => {
    const push = createFrameDecoder(() => {}, {maxFrameBytes: 8});

    assert.throws(() => push(header(64)), /over the 8 bytes limit/);
});
