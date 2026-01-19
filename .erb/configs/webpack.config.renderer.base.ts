/**
 * Base webpack config for renderer process
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';

const configuration: webpack.Configuration = {
  // No externals for renderer - we want to bundle everything
  externals: [],

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
              module: 'esnext',
              moduleResolution: 'node',
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
    ],
  },

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react-dom': path.resolve(webpackPaths.rootPath, 'node_modules/react-dom'),
    },
    plugins: [new TsconfigPathsPlugins({
      configFile: path.resolve(__dirname, '../../tsconfig.renderer.json'),
    })],
    fallback: {
      fs: false,
      path: require.resolve('path-browserify'),
      crypto: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser.js'),
      events: require.resolve('events/'),
      util: false,
      child_process: false,
    },
  },

  plugins: [
    new webpack.EnvironmentPlugin({ NODE_ENV: 'production' }),
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),
    // Define window.require for webpack's HMR
    new webpack.DefinePlugin({
      'window.require': 'undefined',
    }),
  ],
};

export default configuration;