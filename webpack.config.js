// Needed hackery to get __filename and __dirname in ES6 mode
// see: https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-js-when-using-es6-modules
import path from 'node:path';
import {fileURLToPath} from 'node:url';
//import nodeExternals from 'webpack-node-externals';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default (env, argv) => [
    // output an ES6 module
    {
        entry: './src/main.mjs',
        experiments: {
            outputModule: true,
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'homebridge-grumptech-netnanny.js',
            library: {
                type: 'module',
            },
        },
        externalsPresets: {node: true}, // in order to ignore built-in modules like path, fs, etc.
        externals: {
            sqlite3: 'sqlite3',
        },
        module: {
            parser: {
                javascript: {importMeta: argv.mode === 'production' ? false : true},
            },
        },
    },
];
