// Needed hackery to get __filename and __dirname in ES6 mode
// see: https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-js-when-using-es6-modules
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync as _readFileSync} from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * @description Package Information
 * @readonly
 * @private
 */
const _PackageInfo = _getPackageInfo();

export default [
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
            'crypto',
            'node:fs',
            'node:url',
            'node:os',
            'node:path',
            'child_process',
            'buffer',
        ],
        module: {
            parser: {
                javascript: {importMeta: false},
            },
            rules: [
                {
                    test: /main.mjs$/,
                    loader: 'string-replace-loader',
                    options: {
                        multiple: [
                            {search: 'PLACEHOLDER_CONFIG_INFO', replace: _PackageInfo.CONFIG_INFO},
                            {search: 'PLACEHOLDER_VERSION',     replace: _PackageInfo.PLUGIN_VER},
                        ],
                    },
                },
            ],
        },
    },
];

/**
 * @description Helper to get the information of interest from the package.json file.
 * @returns {object} Data of interest.
 * @private
 */
function _getPackageInfo() {
    const packageFilename = path.join(__dirname, './package.json');
    const rawContents = _readFileSync(packageFilename);
    const parsedData = JSON.parse(rawContents);

    const pkgInfo = {CONFIG_INFO: JSON.stringify(parsedData.config_info), PLUGIN_VER: parsedData.version};

    return pkgInfo;
}
