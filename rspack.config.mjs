import {rspack} from '@rspack/core';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Native addons cannot be bundled: they stay required from node_modules.
const NATIVE_MODULES = ['utp-native', 'sodium-native', 'bufferutil', 'utf-8-validate', 'fsevents'];

export default {
    mode: 'production',
    target: 'node',
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        // .cjs on purpose: the bundle is CommonJS, and inside a "type": "module"
        // package a .js file would be loaded as ESM and fail to run.
        filename: 'p2p-eco-node.cjs'
    },
    node: {
        __dirname: false,
        __filename: false
    },
    externalsType: 'commonjs',
    externals: Object.fromEntries(NATIVE_MODULES.map(name => [name, name])),
    plugins: [
        // 'debug' probes for supports-color at require time and copes with its
        // absence; without this the bundler reports it as an unresolved import.
        new rspack.IgnorePlugin({resourceRegExp: /^supports-color$/u})
    ]
};
