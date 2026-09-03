/**
 * Single entry point for runtime configuration.
 *
 * Values come from the environment; `npm start` loads a local `.env` through
 * node's own `--env-file-if-exists`, so there is no dotenv dependency.
 */

const integer = (raw, fallback) => {
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
    /** discovery topic joined by the swarm */
    channel: process.env.P2P_CHANNEL || 'SyncChannel',
    /** listen port; undefined lets get-port pick a free one */
    port: integer(process.env.P2P_PORT, undefined),
    /** overrides the derived node id, handy to run several nodes on one host */
    nodeID: process.env.P2P_NODE_ID || undefined,
    /** how often ResourceManager.check() runs */
    checkIntervalMs: integer(process.env.P2P_CHECK_INTERVAL_MS, 5_000),
    /** frames announcing more than this are refused */
    maxFrameBytes: integer(process.env.P2P_MAX_FRAME_BYTES, 1024 * 1024),
    /** error | warn | info | debug */
    logLevel: process.env.LOG_LEVEL || 'info'
};

export default config;
