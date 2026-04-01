import 'webpack-dev-server';
import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import chalk from 'chalk';
import { execSync, spawn, ChildProcess } from 'child_process';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';

// Track spawned processes to prevent duplicate spawns if setupMiddlewares is called multiple times
let mainProcessSpawned = false;
let preloadProcess: ChildProcess | null = null;
let mainProcess: ChildProcess | null = null;

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
const principalEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'principal-window',
  'index.tsx',
);
const devWorkspaceEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'dev-workspace',
  'index.tsx',
);
const legacyEntryPath = path.join(webpackPaths.srcRendererPath, 'index.tsx');
const alexandriaWorkspaceEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'alexandria-workspace',
  'index.tsx',
);
const titlebarEntryPath = path.join(
  webpackPaths.srcPath,
  'titlebar',
  'index.tsx',
);
const windowSwitcherEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'window-switcher',
  'index.tsx',
);

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

// Register Dev Workspace entry (panel framework window with minimal preload)
if (fs.existsSync(devWorkspaceEntryPath)) {
  entryPoints['dev-workspace'] = devWorkspaceEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'dev-workspace.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['dev-workspace'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: true,
    }),
  );
}

// Register Alexandria Workspace entry when present
if (fs.existsSync(alexandriaWorkspaceEntryPath)) {
  entryPoints['alexandria-workspace'] = alexandriaWorkspaceEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'alexandria-workspace.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['alexandria-workspace'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: true,
    }),
  );
}

// Register titlebar entry when present
if (fs.existsSync(titlebarEntryPath)) {
  entryPoints.titlebar = titlebarEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'titlebar.html',
      template: path.join(webpackPaths.srcPath, 'titlebar', 'index.ejs'),
      chunks: ['titlebar'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: true,
    }),
  );
}

if (fs.existsSync(windowSwitcherEntryPath)) {
  entryPoints['window-switcher'] = windowSwitcherEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'window-switcher.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['window-switcher'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: true,
    }),
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
        // WOFF Font - use webpack 5 asset modules
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
      },
      {
        // WOFF2 Font - use webpack 5 asset modules
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
      },
      {
        // TTF Font - use webpack 5 asset modules
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        exclude: /(^|\/)roboto-mono[^/]*$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
      },
      {
        test: /(^|\/)roboto-mono[^/]*$/i,
        type: 'asset/source',
      },
      {
        // EOT Font - use webpack 5 asset modules
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
      },
      {
        // SVG Font - use webpack 5 asset modules
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
      },
      {
        // Common Image Formats - use webpack 5 asset modules
        test: /\.(png|jpg|jpeg|gif|webp)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
        generator: {
          filename: 'images/[name][ext]',
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
      child_process: false,
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
        { from: /^\/dev-workspace.html/, to: '/dev-workspace.html' },
        {
          from: /^\/alexandria-workspace.html/,
          to: '/alexandria-workspace.html',
        },
        { from: /^\/index.html/, to: '/index.html' },
        { from: /./, to: '/index.html' }
      ]
    },
    setupMiddlewares(middlewares: any) {
      // Prevent duplicate process spawns if setupMiddlewares is called multiple times
      if (mainProcessSpawned) {
        console.log('Processes already spawned, skipping...');
        return middlewares;
      }
      mainProcessSpawned = true;

      console.log('Starting preload.js builder...');
      preloadProcess = spawn('npm', ['run', 'start:preload'], {
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
      mainProcess = spawn('npm', args, {
        shell: true,
        env: process.env,
        stdio: 'inherit',
      })
        .on('close', (code: number) => {
          preloadProcess?.kill();
          process.exit(code!);
        })
        .on('error', (spawnError) => console.error(spawnError));
      return middlewares;
    },
  },
};

export default configuration;