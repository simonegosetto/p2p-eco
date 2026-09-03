<!--<p align="center">
  <a href="" target="blank"><img src="https://github.com/simonegosetto/p2p-eco/blob/master/assets/logo.png?raw=true" width="150" alt="Logo" /></a>
</p>-->

<p align="center">P2P network for synchronizing any type of resource.</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg" alt="Node version" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
</p>

A P2P network meant to keep several archives in sync, extensible with a custom function that
bridges external services, databases and anything else.

## Status

The transport and discovery layers work. **The synchronization algorithm does not exist yet.**

`ResourceManager.check()` announces the local digests to the other nodes on every round, but
nothing reconciles them, and nothing can until the model gains a versioning primitive: a
SHA-256 hash proves two replicas diverged, it says nothing about which one is newer. Picking
that primitive is the open decision tracked in
[issue #2](https://github.com/simonegosetto/p2p-eco/issues/2) — see [Roadmap](#roadmap).

## Architecture

```
src/index.js                    bootstrap: builds the node, registers resources, runs check()
├── src/config.js               every runtime knob, read from the environment
└── src/core/
    ├── node.js                 swarm, peer registry, connection lifecycle
    ├── peer.js                 one connection, writes framed envelopes
    ├── framing.js              length-prefix codec over the byte stream
    ├── logger.js               levelled logging
    └── resource/
        ├── resource-manager.js resource registry + anti-entropy round
        └── resource.js         "abstract" resource: values, hash, sync() hook
```

### Wire format

A connection is a byte stream, not a message channel, so every message carries its own size:

```
+--------------------+------------------------+
| size (uint32 BE)   | msgpack body (size B)  |
+--------------------+------------------------+
```

The body is an envelope: `{v, type, from, data}`. `v` is the protocol version, `type` the
message kind (`hello`, `resource-digest`). Frames larger than `P2P_MAX_FRAME_BYTES` are
refused and the connection is dropped.

## Requirements

Node.js **>= 22.12** (see `.nvmrc`).

## Usage

```bash
npm install          # install dependencies
npm start            # run a node
npm run dev          # run a node, reloading on change
npm test             # unit tests
npm run test:integration   # needs real discovery, see the note below
npm run lint         # eslint
npm run build        # bundle to dist/p2p-eco-node.cjs
```

To run two nodes on the same host, give them distinct identifiers:

```bash
P2P_NODE_ID=alpha npm start
P2P_NODE_ID=beta  npm start
```

The bundle produced by `npm run build` is CommonJS (hence `.cjs`, since this package is
`"type": "module"`). Native addons are not bundled, so `node_modules` still has to be present
next to it.

## Configuration

Every value is read from the environment; `npm start` picks up a local `.env` through node's
own `--env-file-if-exists`, so there is no dotenv dependency. Copy `.env.example` to get
started.

| Variable | Default | Meaning |
|---|---|---|
| `P2P_CHANNEL` | `SyncChannel` | discovery topic joined by the swarm |
| `P2P_PORT` | auto | listen port; empty lets `get-port` pick a free one |
| `P2P_NODE_ID` | derived | overrides the node identifier, to run several nodes on one host |
| `P2P_CHECK_INTERVAL_MS` | `5000` | how often an anti-entropy round runs |
| `P2P_MAX_FRAME_BYTES` | `1048576` | frames announcing more than this are refused |
| `LOG_LEVEL` | `info` | `silent`, `error`, `warn`, `info` or `debug` |

## Adding a resource

`Resource` is the extension point: subclass it and implement `sync()` to reach the backend the
resource actually lives in.

```js
import Resource from './core/resource/resource.js';

class UsersTable extends Resource {
    async sync() {
        // pull from MySQL, RabbitMQ, an HTTP API, ...
        this.values = await loadUsers();
        this.updateHash();
    }
}

node.resourceManager.addResource(new UsersTable('users'));
```

## Roadmap

The open decision is the consistency model; the algorithm follows from it.

1. **Merkle + set reconciliation** — turn a resource into a Merkle tree, exchange roots and
   descend only into diverging ranges (anti-entropy à la Dynamo). Still needs a logical clock
   on top to order concurrent writes.
2. **A mature CRDT** (Loro, Yjs, Automerge) — convergence and conflict-free merge by
   construction, which sidesteps the versioning problem entirely.
3. **Hypercore / Autobase on hyperswarm** — append-only multi-writer log with incremental
   replication, encryption and hole punching already solved.
4. **libp2p + gossipsub** — the industry-standard stack, multi-transport, opens the door to
   browser nodes.

Two orthogonal directions worth keeping in mind: anchoring each resource's Merkle root on a
blockchain gives newcomers a tamper-evident checkpoint without putting data on chain, and
`Resource.sync()` is the natural place for a MySQL adapter driven by stored procedures or
binlog CDC.

### Known transport limitation

`discovery-swarm` and `dat-swarm-defaults` belong to the Dat ecosystem, unmaintained since
around 2019, and they do not hold a link up: two peers on the same channel reconnect and drop
each other roughly once a second. This reproduces with the bare library and none of this
project's code in the path, so it is a property of the transport, not a bug here — and it is
the main practical argument for options 3 and 4 above. There is no authentication, no
encryption and no message signing either: anyone who knows the channel name can join and
inject resources.

Because of the flapping, the wire contract is pinned down over a real stream in
`test/unit/wire.test.js` rather than through the swarm; `test/integration/` covers discovery
separately and is kept out of `npm test`.

## Author

[Simone Gosetto](https://github.com/simonegosetto)

## License

[MIT](LICENSE)
