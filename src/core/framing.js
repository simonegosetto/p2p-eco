import msgpack from 'msgpack-lite';

/**
 * Length-prefix framing for msgpack payloads.
 *
 * A peer connection is a *stream*, not a message channel: a single 'data' event
 * can carry half a message or three of them. Every frame is therefore prefixed
 * with its size, so the receiver can tell where one message ends and the next
 * begins.
 *
 *   +--------------------+------------------------+
 *   | size (uint32 BE)   | msgpack body (size B)  |
 *   +--------------------+------------------------+
 */

export const HEADER_BYTES = 4;
export const DEFAULT_MAX_FRAME_BYTES = 1024 * 1024;

/**
 * @param payload any msgpack-serializable value
 * @returns {Buffer} header + body, ready to be written on a socket
 */
export function encodeFrame(payload) {
    const body = msgpack.encode(payload);
    const header = Buffer.allocUnsafe(HEADER_BYTES);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body]);
}

/**
 * Builds a stateful decoder that turns a stream of chunks into whole messages.
 *
 * The accumulation buffer is per-connection state: create one decoder for each
 * peer, never share an instance between sockets.
 *
 * @param onMessage called once per complete frame
 * @param maxFrameBytes frames announcing more than this are refused
 * @param onError called with decode failures and with the fatal size violation
 * @returns {(chunk: Buffer|string) => void} feed it every 'data' chunk
 */
export function createFrameDecoder(onMessage, {maxFrameBytes = DEFAULT_MAX_FRAME_BYTES, onError} = {}) {
    let pending = Buffer.alloc(0);
    let poisoned = false;

    const fail = error => {
        if (onError) onError(error);
        else throw error;
    };

    return function push(chunk) {
        // an oversized frame leaves the stream unresynchronizable: we no longer
        // know where the next header starts, so the decoder stays shut.
        if (poisoned) return;

        // 'latin1' is the only lossless single-byte decoding: a string chunk
        // only shows up when the socket has an encoding set, and utf8 would
        // mangle every byte above 0x7F.
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'latin1');
        pending = pending.length === 0 ? bytes : Buffer.concat([pending, bytes]);

        while (pending.length >= HEADER_BYTES) {
            const size = pending.readUInt32BE(0);

            if (size > maxFrameBytes) {
                poisoned = true;
                pending = Buffer.alloc(0);
                fail(new Error(`frame announces ${size} bytes, over the ${maxFrameBytes} bytes limit`));
                return;
            }

            // frame still incomplete: wait for more chunks
            if (pending.length < HEADER_BYTES + size) break;

            const body = pending.subarray(HEADER_BYTES, HEADER_BYTES + size);
            pending = pending.subarray(HEADER_BYTES + size);

            try {
                onMessage(msgpack.decode(body));
            } catch (error) {
                // the frame boundary is known, so a malformed body only costs
                // this message: keep draining the rest of the buffer.
                fail(error);
            }
        }
    };
}
