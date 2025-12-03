/**
 * Build config for electron renderer process - Production with multiple entry points
 */

import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
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
const entryPoints: { [key: string]: string } = {};
const htmlPlugins: HtmlWebpackPlugin[] = [];

// Check if principal-window entry exists
const principalEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'principal-window',
  'index.tsx',
);
const repoManagerEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'repo-manager',
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
const quickOpenEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'quick-open',
  'index.tsx',
);
const extensionWindowEntryPath = path.join(
  webpackPaths.srcRendererPath,
  'extension-window',
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
      isDevelopment: false,
    })
  );
}

if (fs.existsSync(repoManagerEntryPath)) {
  entryPoints['repo-manager'] = repoManagerEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: 'repo-manager.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['repo-manager'],
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
      isDevelopment: false,
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
      isDevelopment: false,
    })
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
      isDevelopment: false,
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
      isDevelopment: false,
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
      isDevelopment: false,
    }),
  );
}

// Register Extension Window entry when present
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
      isDevelopment: false,
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
    isDevelopment: false,
  })
);

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
    filename: '[name].js',
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
      new CssMinimizerPlugin(),
    ],
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
        test: /\.s(a|c)ss$/,
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
        include: /\.module\.s(c|a)ss$/,
      },
      {
        test: /\.s(a|c)ss$/,
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
        exclude: /\.module\.s(c|a)ss$/,
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
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
      'react/jsx-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/react/jsx-runtime'
      ),
      'react/jsx-dev-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/react/jsx-runtime'
      ),
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
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),

    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
    }),

    // Define window.require for webpack's HMR
    new webpack.DefinePlugin({
      'window.require': 'undefined',
    }),

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

    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true',
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
};

export default configuration;