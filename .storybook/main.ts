import type { StorybookConfig } from '@storybook/react-webpack5';
import type { Configuration as WebpackConfiguration } from 'webpack';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-webpack5-compiler-swc",
    "@storybook/addon-docs",
  ],
  "framework": {
    "name": "@storybook/react-webpack5",
    "options": {}
  },
  webpackFinal: async (config: Configuration) => {
    // Allow Storybook to be embedded in Electron webviews
    // Based on research: don't set frame-ancestors at all, use X-Frame-Options instead
    config.devServer = {
      ...config.devServer,
      headers: {
        ...config.devServer?.headers,
        // Allow framing in Electron webviews
        'X-Frame-Options': 'ALLOWALL',
      },
    };
    return config;
  },
};
export default config;
