import 'webpack-dev-server';
import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const port = process.env.PORT || 1212;
const manifest = path.resolve(webpackPaths.dllPath, 'renderer.json');
const skipDLLs =
  module.parent?.filename.includes('webpack.config.renderer.dev.dll') ||
  module.parent?.filename.includes('webpack.config.eslint');

/**
 * Warn if the DLL is not built
 */
if (
  !skipDLLs &&
  !(fs.existsSync(webpackPaths.dllPath) && fs.existsSync(manifest))
) {
  console.log(
    chalk.black.bgYellow.bold(
      'The DLL files are missing. Sit back while we build them for you with "npm run build-dll"',
    ),
  );
  execSync('npm run postinstall');
}

// Define entry points for different windows
const entryPoints: { [key: string]: string } = {};
const htmlPlugins: HtmlWebpackPlugin[] = [];

// Check if principal-window entry exists
const principalEntryPath = path.join(webpackPaths.srcRendererPath, 'principal-window', 'index.tsx');
const legacyEntryPath = path.join(webpackPaths.srcRendererPath, 'index.tsx');

// Use principal entry if it exists, otherwise fall back to legacy
if (fs.existsSync(principalEntryPath)) {
  entryPoints.principal = principalEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'principal.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['principal'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: true,
    })
  );
}

// Always include legacy entry for backward compatibility
entryPoints.main = legacyEntryPath;
htmlPlugins.push(
  new HtmlWebpackPlugin({
    filename: 'index.html',
    template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
    chunks: ['main'],
    minify: {
      collapseWhitespace: true,
      removeAttributeQuotes: true,
      removeComments: true,
    },
    isBrowser: false,
    isDevelopment: true,
  })
);

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'development',

  target: 'web',

  // Bundle everything - no externals
  externals: [],

  stats: 'errors-only',

  optimization: {
    // Ensure all modules are bundled
    providedExports: true,
    usedExports: true,
    sideEffects: false,
    // Share common code between entry points
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },

  entry: entryPoints,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: '[name].dev.js',
  },

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules\/(?!@a24z\/panels)/,
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
      {
        test: /\.(js|mjs|jsx)$/,
        include: /node_modules\/@excalidraw/,
        resolve: {
          fullySpecified: false,
        },
      },
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
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        // WOFF Font
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          },
        },
      },
      {
        // WOFF2 Font
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          },
        },
      },
      {
        // TTF Font
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        exclude: /(^|\/)roboto-mono[^/]*$/i,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/octet-stream',
          },
        },
      },
      {
        test: /(^|\/)roboto-mono[^/]*$/i,
        type: 'asset/source',
      },
      {
        // EOT Font
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        use: 'file-loader',
      },
      {
        // SVG Font
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'image/svg+xml',
          },
        },
      },
      {
        // Common Image Formats
        test: /\.(png|jpg|jpeg|gif|webp)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'images/[name].[ext]',
          },
        },
      },
    ],
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
      '@shared': path.resolve(webpackPaths.srcRendererPath, 'shared'),
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
    },
  },

  ignoreWarnings: [
    /Critical dependency: require function is used in a way/,
  ],

  plugins: [
    ...(skipDLLs
      ? []
      : [
          new webpack.DllReferencePlugin({
            context: webpackPaths.dllPath,
            manifest: require(manifest),
            sourceType: 'var',
          }),
        ]),

    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),

    // Define window.require for webpack's HMR
    new webpack.DefinePlugin({
      'window.require': 'undefined',
    }),

    new ReactRefreshWebpackPlugin(),

    new MonacoWebpackPlugin({
      languages: [
        'typescript',
        'javascript',
        'python',
        'markdown',
        'yaml',
        'json',
        'html',
        'css',
      ],
    }),

    ...htmlPlugins,
  ],

  node: {
    __dirname: false,
    __filename: false,
  },

  devServer: {
    port,
    compress: true,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: {
      publicPath: '/',
    },
    historyApiFallback: {
      // Allow dots in paths and properly rewrite principal.html
      disableDotRule: true,
      rewrites: [
        { from: /^\/principal.html/, to: '/principal.html' },
        { from: /^\/index.html/, to: '/index.html' },
        { from: /./, to: '/index.html' }
      ]
    },
    setupMiddlewares(middlewares: any) {
      console.log('Starting preload.js builder...');
      const preloadProcess = spawn('npm', ['run', 'start:preload'], {
        shell: true,
        stdio: 'inherit',
      })
        .on('close', (code: number) => process.exit(code!))
        .on('error', (spawnError) => console.error(spawnError));

      console.log('Starting Main Process...');
      let args = ['run', 'start:main'];
      if (process.env.MAIN_ARGS) {
        args = args.concat(
          ['--', ...process.env.MAIN_ARGS.matchAll(/"[^"]+"|[^\s"]+/g)].flat(),
        );
      }
      spawn('npm', args, {
        shell: true,
        env: process.env,
        stdio: 'inherit',
      })
        .on('close', (code: number) => {
          preloadProcess.kill();
          process.exit(code!);
        })
        .on('error', (spawnError) => console.error(spawnError));
      return middlewares;
    },
  },
};

export default configuration;