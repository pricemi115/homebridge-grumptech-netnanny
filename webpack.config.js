// Needed hackery to get __filename and __dirname in ES6 mode
// see: https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-js-when-using-es6-modules
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default [
/*
    // output an old-style universal module for use in browsers
    {
        entry: './src/main.mjs',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'homebridge-grumptech-volmon.js',
            library: {
                name: 'homebridge-grumptech-volmon',
                type: 'umd',
                export: 'default',
            },
        },
        externals: [
            'child_process', 'fs', 'fs/promises', 'url', 'os', 'path',
        ],
    },
*/
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
        externals: [
            'url', 'fs', 'path', 'crypto', 'child_process'
        ],
        module: {
            parser: {
              javascript : { importMeta: false }
            }
        }
    },
];
