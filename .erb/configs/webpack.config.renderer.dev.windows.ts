import 'webpack-dev-server';
import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
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

// Check if principal-window entry exists
const principalEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'principal-window',
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
const quickOpenEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'quick-open',
  'index.tsx',
);
const devWorkspaceEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'dev-workspace',
  'index.tsx',
);
const extensionWindowEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'extension-window',
  'index.tsx',
);

// Define entry points - use object format for multiple named entries
const entryPoints: { [key: string]: string } = {};
const htmlPlugins: HtmlWebpackPlugin[] = [];

// Add principal entry if it exists
if (fs.existsSync(principalEntryPath)) {
  entryPoints.principal = principalEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'principal.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['principal'], // Only include principal chunk
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

// Add Alexandria Workspace entry if it exists
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
    })
  );
}

// Add titlebar entry if it exists
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

if (fs.existsSync(quickOpenEntryPath)) {
  entryPoints['quick-open'] = quickOpenEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'quick-open.html',
      template: path.join(webpackPaths.srcRendererPath, 'quick-open.ejs'),
      chunks: ['quick-open'],
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

// Add Dev Workspace entry if it exists
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

// Add Extension Window entry if it exists
if (fs.existsSync(extensionWindowEntryPath)) {
  entryPoints['extension-window'] = extensionWindowEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'extension-window.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['extension-window'],
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

// Always add legacy entry for index.html (dashboard, etc.)
entryPoints.main = legacyEntryPath;
htmlPlugins.push(
  new HtmlWebpackPlugin({
    filename: 'index.html',
    template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
    chunks: ['main'], // Only include main chunk
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
  },

  entry: entryPoints,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: '[name].dev.js', // Use chunk name in filename
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
        test: /\.s?(c|a)ss$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: true,
            },
          },
          'sass-loader',
        ],
        exclude: /\.module\.s?(c|a)ss$/,
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // Images
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      // SVG
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              prettier: false,
              svgo: false,
              svgoConfig: {
                plugins: [{ removeViewBox: false }],
              },
              titleProp: true,
              ref: true,
            },
          },
        ],
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
      '.mjs': ['.mjs', '.mts'],
    },
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react-dom': path.resolve(webpackPaths.rootPath, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(webpackPaths.rootPath, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(webpackPaths.rootPath, 'node_modules/react/jsx-dev-runtime'),
      events: require.resolve('events/'),
    },
    plugins: [new TsconfigPathsPlugins()],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser.js'),
      events: require.resolve('events/'),
      child_process: false,
    },
  },

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

    new webpack.NoEmitOnErrorsPlugin(),

    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.DefinePlugin({
      global: 'globalThis',
      'global.GENTLY': false,
      // Define Electron renderer globals
      'process.type': '"renderer"',
      'process.platform': JSON.stringify(process.platform),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),

    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),
    
    // Add banner to define global and globalThis at the top of the bundle for Windows
    // Exclude worker files using the exclude option
    new webpack.BannerPlugin({
      banner: 'if (typeof global === "undefined") { window.global = window; } if (typeof globalThis === "undefined") { window.globalThis = window; }',
      raw: true,
      entryOnly: true,
      test: /\.js$/,
      exclude: /\.worker\.js$/,
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),

    // new ReactRefreshWebpackPlugin(),

    new MonacoWebpackPlugin({
      languages: [
        'javascript',
        'typescript',
        'css',
        'html',
        'json',
        'markdown',
        'python',
        'java',
        'cpp',
        'csharp',
        'go',
        'rust',
        'php',
        'ruby',
        'swift',
        'kotlin',
        'sql',
        'yaml',
        'xml',
      ],
      features: ['!gotoSymbol'],
    }),

    // Copy ghostty-web WASM file to dist for terminal panel
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(webpackPaths.rootPath, 'node_modules/ghostty-web/ghostty-vt.wasm'),
          to: path.resolve(webpackPaths.distRendererPath, 'ghostty-vt.wasm'),
        },
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
    hot: false,
    liveReload: true,
    client: {
      overlay: false,  // Disable the error overlay completely
    },
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: {
      publicPath: '/',
      directory: webpackPaths.distPath,
    },
    historyApiFallback: {
      verbose: true,
      // Allow dots in paths and properly rewrite principal.html
      disableDotRule: true,
      rewrites: [
        { from: /^\/principal.html/, to: '/principal.html' },
        {
          from: /^\/alexandria-workspace.html/,
          to: '/alexandria-workspace.html',
        },
        {
          from: /^\/dev-workspace.html/,
          to: '/dev-workspace.html',
        },
        {
          from: /^\/extension-window.html/,
          to: '/extension-window.html',
        },
        {
          from: /^\/window-switcher.html/,
          to: '/window-switcher.html',
        },
        {
          from: /^\/quick-open.html/,
          to: '/quick-open.html',
        },
        { from: /^\/index.html/, to: '/index.html' },
        { from: /./, to: '/index.html' }
      ]
    },
    setupMiddlewares(middlewares) {
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