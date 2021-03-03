import nodePolyfills  from 'rollup-plugin-node-polyfills';
import json           from '@rollup/plugin-json';

export default {
  external: ['homebridge'],
  input: 'src/main.js',
  output: [
    {
      file: 'dist/homebridge-grumptech-netnanny.js',
      format: 'cjs',
      exports: 'named'
    },
  ],
  plugins: [
    nodePolyfills(),
    json()
  ]
};
