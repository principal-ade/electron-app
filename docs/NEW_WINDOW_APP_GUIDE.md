# New Window Application Guide

## Overview
This document explains how to scaffold a brand-new renderer application that lives alongside the legacy renderer and the Principal View application. The steps mirror the way `principal-window` is treated as its own app: you create a dedicated renderer entry point, emit a distinct HTML file, and teach the Electron main process how to load it.

When you are finished, you will be able to run the new window during development with the multi-entry dev server (`npm run start:multi`) and package it for production with the standard build pipeline.

---

## 1. Renderer Folder Structure
Create a top-level folder under `src/renderer` for the new window. Follow the same conventions used by `src/renderer/principal-window` so components, hooks, and local state are easy to reason about.

```
src/renderer/<window-name>/
├── components/
├── hooks/
├── context/                # Optional: local providers/state
├── <WindowName>App.tsx     # Root component for the window
├── index.tsx               # Bootstraps React into #root
└── styles/                 # Window-specific styles (optional)
```

**Scaffolding checklist**
1. `index.tsx` should mirror `principal-window/index.tsx`: import global styles, create the React root, and render `<WindowNameApp />`. 【F:src/renderer/principal-window/index.tsx†L1-L14】
2. Keep shared UI in `src/renderer/components` or `src/renderer/shared` so multiple windows can reuse them.
3. Store window-specific hooks/components under the new folder to keep coupling low.

---

## 2. Webpack Entry Points & HTML Output
Each standalone window must register itself as a named entry in the multi-bundle webpack configs. Follow the pattern already used for the Principal window.

### 2.1 Development (Unix/macOS/Linux)
Update `.erb/configs/webpack.config.renderer.dev.multi.ts`:
- Add a new entry in `entryPoints` that points at `src/renderer/<window-name>/index.tsx`.
- Push a matching `HtmlWebpackPlugin` instance that emits `<window-name>.html` and only includes the new chunk.
- Extend the `historyApiFallback.rewrites` array so requests to `/\<window-name>.html` are returned directly. 【F:.erb/configs/webpack.config.renderer.dev.multi.ts†L39-L96】【F:.erb/configs/webpack.config.renderer.dev.multi.ts†L255-L288】

```ts
const newWindowEntryPath = path.join(
  webpackPaths.srcRendererPath,
  '<window-name>',
  'index.tsx',
);

if (fs.existsSync(newWindowEntryPath)) {
  entryPoints['<window-name>'] = newWindowEntryPath;
  htmlPlugins.push(
    new HtmlWebpackPlugin({
      filename: '<window-name>.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      chunks: ['<window-name>'],
      isBrowser: false,
      isDevelopment: true,
    }),
  );
}
```

Add a rewrite so hot reload knows how to serve it:

```ts
rewrites: [
  { from: /^\/principal.html/, to: '/principal.html' },
  { from: /^\/index.html/, to: '/index.html' },
  { from: /^\/<window-name>\.html/, to: '/<window-name>.html' },
  { from: /./, to: '/index.html' },
];
```

### 2.2 Development (Windows)
Make the same changes in `.erb/configs/webpack.config.renderer.dev.windows.ts`. This config mirrors the Unix version but disables HMR, so keep the entry, HTML plugin, and rewrite list in sync. 【F:.erb/configs/webpack.config.renderer.dev.windows.ts†L36-L93】【F:.erb/configs/webpack.config.renderer.dev.windows.ts†L323-L338】

### 2.3 Production Builds
Update `.erb/configs/webpack.config.renderer.prod.multi.ts` with the same entry + `HtmlWebpackPlugin` pair. Production builds also split shared code through `splitChunks`, so the only difference from development is that `isDevelopment` should be `false` and the emitted filename will be `<window-name>.js`. 【F:.erb/configs/webpack.config.renderer.prod.multi.ts†L22-L74】

There is no need to touch the legacy single-entry configs (`renderer.dev.standalone.ts`, `renderer.prod.standalone.ts`) unless you plan to run the new window outside of the multi-entry workflow.

---

## 3. Loading the Window from the Main Process
Windows are created through `ModernWindowManager`. The helper `resolveHtmlPath` converts the HTML filename into either a `http://localhost` URL (during development) or a `file://` URL (in production). 【F:src/main/window/modernWindowManager.ts†L520-L537】【F:src/main/util.ts†L7-L16】

To load your new window:
1. Decide when the window should be created (e.g., on startup, or from a command/IPC handler).
2. Call `resolveHtmlPath('<window-name>.html')` and load that URL once the `BrowserWindow` instance has been constructed.

**Example (`modernWindowHandlers.ts`):**
```ts
import { resolveHtmlPath } from '../util';
import { createSpecialWindow } from './modernWindowManager';

export function openNewWindowApp() {
  const window = createSpecialWindow(
    'my-new-window',
    {
      width: 1280,
      height: 800,
      show: false,
    },
    { integratedTitlebar: true },
  );

  if (!window) {
    return;
  }

  window.window.loadURL(resolveHtmlPath('<window-name>.html'));
}
```

Use `createSpecialWindow` when you want a named singleton (subsequent calls focus the same window) or the `createWindow` helper for a brand-new `BrowserWindow`. The important part is that the URL matches the HTML you emitted via webpack.

---

## 4. Development & Packaging Checklist
- **Development:** Use `npm run start:multi` to serve all renderer entry points at once. The new HTML page will be available at `http://localhost:1212/<window-name>.html` and can be loaded through the main process after the dev server boots. 【F:package.json†L66-L76】
- **TypeScript:** No extra `tsconfig` updates are needed; `tsconfig.renderer.json` already includes `src/renderer/**/*`. 【F:tsconfig.renderer.json†L1-L22】
- **Shared Styles:** Add any window-specific Tailwind or CSS imports in your `index.tsx` (similar to the Principal window). 【F:src/renderer/principal-window/index.tsx†L1-L7】
- **Production:** `npm run build` or `npm run package` will automatically bundle the new entry because both production and Windows dev configs share the same multi-entry logic. 【F:package.json†L7-L64】【F:.erb/configs/webpack.config.renderer.prod.multi.ts†L22-L107】

---

## 5. Quick Reference Snippets
| Task | Location | Notes |
| ---- | -------- | ----- |
| Register renderer entry | `.erb/configs/webpack.config.renderer.dev.multi.ts` / `.dev.windows.ts` / `.prod.multi.ts` | Add entry + `HtmlWebpackPlugin` + rewrite |
| Bootstrap React root | `src/renderer/<window-name>/index.tsx` | Copy structure from `principal-window/index.tsx` |
| Load HTML in Electron | `src/main/window/modernWindowManager.ts` or dedicated handler | Call `resolveHtmlPath('<window-name>.html')` |
| Run dev server | `npm run start:multi` | Serves all renderer apps |

With these pieces in place you can iterate on the new window independently while still sharing code through `src/renderer/components`, `providers`, and other shared modules.
