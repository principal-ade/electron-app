/**
 * Base webpack config for main process
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import { dependencies as externals } from '../../release/app/package.json';
import webpackPaths from './webpack.paths';

const configuration: webpack.Configuration = {
  // Externalize all dependencies from release/app/package.json
  // These will be available in node_modules at runtime
  externals: [
    ...Object.keys(externals || {}),
  ],

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