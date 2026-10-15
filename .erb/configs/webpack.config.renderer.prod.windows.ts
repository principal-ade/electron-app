/**
 * Build config for electron renderer process - Production
 */

import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';

checkNodeEnv('production');
deleteSourceMaps();

// Define entry points for different windows
const legacyEntryPath = path.join(webpackPaths.srcRendererPath, 'index.tsx');
const principalEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'principal-window',
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
const goodbyeScreenEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'goodbye-screen',
  'index.tsx',
);
const splashScreenEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'splash-screen',
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
      chunks: ['principal'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: false,
    })
  );
}

// Add window switcher entry if it exists
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
      isDevelopment: false,
    }),
  );
}

// Add quick open entry if it exists
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
      isDevelopment: false,
    }),
  );
}

// Add goodbye screen entry if it exists
if (fs.existsSync(goodbyeScreenEntryPath)) {
  entryPoints['goodbye-screen'] = goodbyeScreenEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'goodbye-screen.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['goodbye-screen'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: false,
    }),
  );
}

// Add splash screen entry if it exists
if (fs.existsSync(splashScreenEntryPath)) {
  entryPoints['splash-screen'] = splashScreenEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'splash-screen.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['splash-screen'],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: false,
    }),
  );
}

// Always add legacy entry for index.html (dashboard, etc.)
entryPoints.main = legacyEntryPath;

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  target: 'web',

  // Bundle everything - no externals
  externals: [],

  stats: 'errors-only',

  entry: entryPoints,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: './',
    filename: '[name].js', // Use chunk name in filename
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
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
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
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: true,
            },
          },
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

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
      new CssMinimizerPlugin(),
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
      'react/jsx-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/react/jsx-runtime'
      ),
      'react/jsx-dev-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/react/jsx-dev-runtime'
      ),
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
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),

    new webpack.DefinePlugin({
      global: 'globalThis',
      'global.GENTLY': false,
      // Define Electron renderer globals
      'process.type': '"renderer"',
      'process.platform': JSON.stringify(process.platform),
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),

    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),

    // Add banner to define global and globalThis at the top of the bundle for Windows
    new webpack.BannerPlugin({
      banner: 'if (typeof global === "undefined") { window.global = window; } if (typeof globalThis === "undefined") { window.globalThis = window; }',
      raw: true,
      entryOnly: true,
      test: /\.js$/,
    }),

    new MiniCssExtractPlugin({
      filename: 'style.css',
    }),

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

    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8889,
    }),

    // Legacy index.html for main window
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
      isDevelopment: false,
      nodeModules: webpackPaths.appNodeModulesPath,
    }),

    // Add all dynamic HTML plugins for different windows
    ...htmlPlugins,
  ],
};

export default configuration;