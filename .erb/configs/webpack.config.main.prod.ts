/**
 * Webpack config for production electron main process
 */

import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import baseConfig from './webpack.config.main.base';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';
import { dependencies as externals } from '../../package.json';

checkNodeEnv('production');
deleteSourceMaps();

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  target: 'electron-main',

  entry: {
    main: path.join(webpackPaths.srcMainPath, 'main.ts'),
    preload: path.join(webpackPaths.srcWindowPath, 'preload.ts'),
    'preload-dev-workspace': path.join(
      webpackPaths.srcWindowPath,
      'preload-dev-workspace.ts',
    ),
    'preload-extension-window': path.join(
      webpackPaths.srcWindowPath,
      'preload-extension-window.ts',
    ),
    'preload-quick-open': path.join(
      webpackPaths.srcWindowPath,
      'preload-quick-open.ts',
    ),
    'preload-window-switcher': path.join(
      webpackPaths.srcWindowPath,
      'preload-window-switcher.ts',
    ),
    terminal: path.join(webpackPaths.srcMainPath, 'terminal', 'index.ts'),
    'event-worker': path.join(
      webpackPaths.srcPath,
      'event-processing-server',
      'worker-entry.ts',
    ),
    'terminal-worker': path.join(
      webpackPaths.srcPath,
      'terminal-worker',
      'worker-entry.ts',
    ),
  },

  // Override externals - don't externalize dependencies for workers
  externals: [
    ({ request, context, contextInfo, getResolve }, callback) => {
      // For the worker entries, bundle everything except native modules
      const isEventWorker =
        context?.includes('event-processing-server') ||
        contextInfo?.issuer?.includes('event-processing-server');

      const isTerminalWorker =
        context?.includes('terminal-worker') ||
        contextInfo?.issuer?.includes('terminal-worker');

      // Event worker bundles everything (no native modules)
      if (isEventWorker) {
        return callback();
      }

      // Terminal worker bundles everything EXCEPT node-pty
      if (isTerminalWorker) {
        if (request === 'node-pty') {
          return callback(null, `commonjs ${request}`);
        }
        return callback(); // Bundle everything else
      }

      // For main and preload, externalize node_modules as usual
      if (Object.keys(externals || {}).includes(request) || ['node-pty', 'keytar'].includes(request)) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    },
  ],

  output: {
    path: webpackPaths.distMainPath,
    filename: '[name].js',
    library: {
      type: 'umd',
    },
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8888,
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
      START_MINIMIZED: false,
    }),

    new webpack.DefinePlugin({
      'process.type': '"browser"',
    }),

    // Copy worker files to production build
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(webpackPaths.srcMainPath, 'electron-cli-bridge/workers'),
          to: path.join(webpackPaths.distMainPath, 'workers'),
          globOptions: {
            ignore: ['**/*.ts', '**/*.map'],
          },
        },
      ],
    }),
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default merge(baseConfig, configuration);
