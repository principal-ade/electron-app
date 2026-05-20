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

    // Some renderer code transitively imports `src/telemetry/config.ts`, which
    // does a runtime `require('electron')` (no-op'd in the renderer). Webpack
    // still resolves the require statically and chokes on electron's own
    // node-only deps (`fs`, `path`). Alias the package + its deps to empty
    // modules so storybook can bundle renderer code that touches telemetry.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback as Record<string, string | false> | undefined),
      electron: false,
      fs: false,
      path: false,
    };
    return config;
  },
};
export default config;
