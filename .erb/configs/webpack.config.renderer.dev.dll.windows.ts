/**
 * Builds the DLL for development electron renderer process
 */

import webpack from 'webpack';
import path from 'path';
import webpackPaths from './webpack.paths';
import { dependencies } from '../../package.json';
import checkNodeEnv from '../scripts/check-node-env';

checkNodeEnv('development');

const dist = webpackPaths.dllPath;

const configuration: webpack.Configuration = {
  context: webpackPaths.rootPath,

  devtool: 'eval',

  mode: 'development',

  target: 'web',

  // Bundle everything except observability SDK (which uses Node.js modules)
  externals: [
    '@a24z/observability-sdk',
    /^@types\/.*$/,  // Exclude all @types packages (TypeScript type definitions)
  ],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.js$/,
        include: /node_modules\/.pnpm\/universal-user-agent/,
        use: [
          {
            loader: path.resolve(__dirname, 'process-polyfill-loader.js'),
          },
        ],
      },
      {
        test: /\.(js|mjs|jsx)$/,
        include: /node_modules\/@excalidraw/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      ...require('./webpack.config.renderer.dev.standalone').default.module.rules,
    ],
  },

  entry: {
    renderer: Object.keys(dependencies || {}).filter(
      (dependency) => {
        // Exclude all Node.js specific packages
        const nodeOnlyPackages = [
          '@modelcontextprotocol/sdk',
          'simple-git', // Git operations library - Node.js only, uses child_process
          'electron-debug',
          'electron-devtools-installer',
          'electron-updater',
          'electron-log',
          'electron-store',
          'node-pty',
          'express',
          'concurrently',
          'dotenv',
          'chokidar',
          'node-fetch',
          'source-map-support',
          'debug',
          'ts-json-schema-generator',
          'fdir', // Fast directory crawler - Node.js only, used in main process
          '@principal-ai/repository-monitoring', // Node.js only watcher library
          '@a24z/core-library', // Has Node.js adapters, globby is a devDep not bundled
          'globby', // Node.js file globbing library
          'glob', // Node.js file globbing library
          'keytar', // Native Node.js module for credential storage
          'jsonwebtoken' // Uses Node.js crypto module
        ];
        
        // Exclude if in the list or contains electron
        return !nodeOnlyPackages.includes(dependency) && 
               !dependency.includes('electron');
      }
    ),
  },

  output: {
    path: dist,
    filename: '[name].dev.dll.js',
    library: {
      name: 'renderer',
      type: 'var',
    },
    globalObject: 'this',
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
      '.mjs': ['.mjs', '.mts'],
    },
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      os: false,
      child_process: false,
      querystring: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser.js'),
      events: require.resolve('events/'),
      util: false,
    },
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react-dom': path.resolve(webpackPaths.rootPath, 'node_modules/react-dom'),
      process: require.resolve('process/browser.js'),
      'process/browser': require.resolve('process/browser.js'),
      events: require.resolve('events/'),
    },
  },

  plugins: [
    new webpack.BannerPlugin({
      banner: 'if (typeof global === "undefined") { window.global = window; } if (typeof globalThis === "undefined") { window.globalThis = window; }',
      raw: true,
      entryOnly: true,
    }),

    new webpack.DllPlugin({
      path: path.join(dist, '[name].json'),
      name: '[name]',
    }),

    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: require.resolve('process/browser.js'),
    }),

    new webpack.DefinePlugin({
      'typeof process': JSON.stringify('object'),
      'typeof process.env': JSON.stringify('object'),
      'process.env': JSON.stringify({}),
      'process.version': JSON.stringify('v16.0.0'),
      'process.platform': JSON.stringify('browser'),
      'process.arch': JSON.stringify('browser'),
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
      options: {
        context: webpackPaths.srcPath,
        output: {
          path: webpackPaths.dllPath,
        },
      },
    }),
  ],
};

export default configuration;