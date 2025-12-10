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

  // Bundle everything except native modules and libraries with Node.js dependencies
  externals: ['keytar', '@principal-ai/observability-sdk', '@a24z/core-library', '@a24z/markdown-search'],

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
          '@egoist/tipc', // Uses subpath exports only (./main, ./renderer) - must be imported directly
          '@modelcontextprotocol/sdk',
          '@principal-ai/repository-monitoring', // Node.js only watcher library
          '@principal-ai/repository-monitoring-server', // Main process only - contains pre-bundled worker
          'simple-git', // Git operations library - Node.js only, uses child_process
          'eslint', // ESLint is Node.js only and should only run in main process
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'eslint-plugin-react',
          'eslint-plugin-react-hooks',
          'eslint-plugin-import',
          'eslint-plugin-jsx-a11y',
          'eslint-plugin-promise',
          'eslint-plugin-compat',
          'eslint-plugin-jest',
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
          'jsonwebtoken', // JWT library is Node.js only
          '@types/jsonwebtoken', // Types for JWT library
          'fdir', // Fast directory crawler - Node.js only, used in main process
          'globby', // File system globbing - Node.js only, uses native fs
          'glob', // Glob pattern matching - Node.js only, uses native fs
          'minipass', // Stream library that uses Node.js internals
          '@a24z/markdown-search' // Has Node.js dependencies for indexing
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
      url: require.resolve('url/'),
      string_decoder: require.resolve('string_decoder/'),
    },
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react-dom': path.resolve(webpackPaths.rootPath, 'node_modules/react-dom'),
      process: require.resolve('process/browser.js'),
      'process/browser': require.resolve('process/browser.js'),
      events: require.resolve('events/'),
      'node:url': require.resolve('url/'),
      'node:string_decoder': require.resolve('string_decoder/'),
      'node:stream': require.resolve('stream-browserify'),
      'node:buffer': require.resolve('buffer/'),
      'node:events': require.resolve('events/'),
      'node:process': require.resolve('process/browser.js'),
      'node:path': false,
      'node:fs': false,
      'node:os': false,
      'node:util': false,
    },
  },

  plugins: [
    new webpack.BannerPlugin({
      banner: 'if (typeof global === "undefined") { window.global = window; }',
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