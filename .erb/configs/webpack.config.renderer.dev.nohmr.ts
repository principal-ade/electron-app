import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';

const configuration: webpack.Configuration = {
  mode: 'development',
  
  devtool: 'source-map',

  target: ['web', 'electron-renderer'],

  entry: path.join(webpackPaths.srcRendererPath, 'index.tsx'),

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: 'renderer.dev.js',
  },
  
  optimization: {
    splitChunks: false,
  },
  
  // Watch mode for development
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000,
  },

  stats: 'normal',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules\/(?!@excalidraw)/,
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
    alias: {
      react: path.resolve(webpackPaths.rootPath, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(webpackPaths.rootPath, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(webpackPaths.rootPath, 'node_modules/react/jsx-dev-runtime'),
      'react-dom': path.resolve(webpackPaths.rootPath, 'node_modules/react-dom'),
    },
    plugins: [new TsconfigPathsPlugins()],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      events: require.resolve('events/'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      child_process: false,
    },
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development'
    }),

    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
      React: 'react',
    }),

    new webpack.DefinePlugin({
      'process.type': '"renderer"',
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

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      env: process.env.NODE_ENV,
      isDevelopment: true,
      nodeModules: webpackPaths.appNodeModulesPath,
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },
};

export default configuration;