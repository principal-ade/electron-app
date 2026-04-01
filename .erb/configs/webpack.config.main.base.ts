/**
 * Base webpack config for main process
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';

// Only externalize native modules that can't be bundled by webpack
// This dramatically reduces the production node_modules size
const nativeModules = [
  'node-pty',
  'keytar',
  'canvas',
  'electron',
  'electron-updater',
];

const configuration: webpack.Configuration = {
  // Only externalize native modules - bundle everything else
  externals: nativeModules,

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      // Handle native .node modules - emit them as separate files
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    alias: {
      'src/main/util': path.resolve(__dirname, '../../src/main/util'),
      // Fix for globby v16 + unicorn-magic conditional exports
      'unicorn-magic/node': path.resolve(__dirname, '../../node_modules/unicorn-magic/node.js'),
    },
    plugins: [new TsconfigPathsPlugins({
      configFile: path.resolve(__dirname, '../../tsconfig.main.json'),
    })],
    // Enable webpack to find exports in package.json
    conditionNames: ['import', 'require', 'node', 'default'],
    exportsFields: ['exports'],
  },

  plugins: [
    new webpack.EnvironmentPlugin({ NODE_ENV: 'production' }),
  ],
};

export default configuration;