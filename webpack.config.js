import path from 'path';
import pkg from 'webpack';
const {IgnorePlugin} = pkg;
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'ansia-node.js'
  },
  plugins: [
    new IgnorePlugin({ resourceRegExp: /^(cache-manager)$/u })
  ],
}
