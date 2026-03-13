/**
 * Webpack config for PTY daemon
 *
 * Builds a standalone Node.js process that manages PTY sessions.
 * This runs independently of Electron.
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';

const isProduction = process.env.NODE_ENV === 'production';

const configuration: webpack.Configuration = {
  mode: isProduction ? 'production' : 'development',

  // Standalone Node.js, NOT Electron
  target: 'node',

  devtool: isProduction ? 'source-map' : 'inline-source-map',

  entry: path.join(webpackPaths.srcPath, 'pty-daemon', 'daemon.ts'),

  output: {
    path: webpackPaths.distMainPath,
    filename: 'pty-daemon.cjs', // Use .cjs since package.json has "type": "module"
    library: { type: 'commonjs2' },
  },

  // Externalize node-pty (native module must be required at runtime)
  externals: {
    'node-pty': 'commonjs node-pty',
  },

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              // Use CommonJS for proper webpack bundling
              module: 'CommonJS',
              moduleResolution: 'node',
            },
          },
        },
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // Allow imports without file extensions (for CommonJS compatibility)
    fullySpecified: false,
    plugins: [
      new TsconfigPathsPlugins({
        configFile: path.resolve(__dirname, '../../tsconfig.main.json'),
      }),
    ],
    conditionNames: ['import', 'require', 'node', 'default'],
    exportsFields: ['exports'],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: isProduction ? 'production' : 'development',
    }),
  ],

  // Don't transform __dirname/__filename
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default configuration;
