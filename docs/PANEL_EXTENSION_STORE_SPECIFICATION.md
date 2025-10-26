# Panel Extension Store: Architecture and Developer Specification

**Document Owner:** Gemini
**Date:** October 15, 2025
**Scope:** Defining the technical requirements for dynamically loading third-party React components (Panels) distributed via NPM, across both Electron and standard Web environments.

---

## 1. Project Goals and Non-Goals

### 1.1 Goals

- **Standardized Distribution:** Use NPM as the primary distribution method for all third-party custom panels.
- **Dual Environment Compatibility:** Panels must load and function correctly within:
  - The Electron application's Node-enabled renderer process.
  - A standard browser-based Web UI development/testing harness.
- **Dependency Sharing:** Core frameworks (`react`, `react-dom`) must be shared from the Host Application to prevent bundling duplicates.
- **Self-Contained Functionality:** Panels must bundle their unique, non-shared dependencies (e.g., `lodash`, `d3.js`) internally.
- **Consistent API:** Define a mandatory, simple contract (metadata and component export) for all panel packages.

### 1.2 Non-Goals (Security Note)

- **Security Sandboxing:** This system is explicitly designed without the use of webview or isolated processes. The focus is on ease of development and trusted extensions. All panels run in the Host Application's main process context, granting them full Node.js access.
- **Dynamic Asset Loading (in Production Web):** We will not support live loading of NPM packages in the production Web UI. The Web UI's primary role is for testing/development where local `node_modules` are available.

---

## 2. Architecture and Components

The system consists of three primary components:

### 2.1 Host Application (Your App)

The application responsible for discovering, loading, and rendering the custom panels.

| Component | Responsibility |
|-----------|----------------|
| **Panel Discovery** | Locates installed NPM packages (panels) in the `node_modules` directory. |
| **Shared API Layer** | Provides core dependencies (React, ReactDOM) as externalized resources for the panels. |
| **Panel Loader** | Executes the dynamic module loading logic based on the environment (Node path resolution vs. standard package import). |
| **Panel Renderer** | A React component that wraps `React.lazy` and `Suspense` to handle the asynchronous rendering of the custom panel component. |

### 2.2 Panel Package (Third-Party Extension)

The external NPM package created by a developer.

| Component | Responsibility |
|-----------|----------------|
| **Source Code** | The React Component and associated logic. |
| **package.json** | Defines `peerDependencies` (shared) and `dependencies` (unique/self-bundled). |
| **Build Toolchain** | Bundles all unique dependencies into a single output file and externalizes shared dependencies. |
| **Output Bundle** | The final, runnable `dist/panel.bundle.js` file. |

---

## 3. Panel Developer Specification (The Contract)

To be compatible with the store, every panel package must adhere to the following rules:

### 3.1 Package Naming and Dependencies

- **NPM Registry:** The panel must be published to a public or private NPM registry.
- **Unique Dependencies (`dependencies`):** Any library unique to the panel (e.g., `gsap`, `axios`) must be listed here and must be bundled into the final output file by the developer's build tool.
- **Shared Dependencies (`peerDependencies`):** `react` and `react-dom` must be listed here. They must be externalized during the panel's build.

### 3.2 Required Export Structure

The panel's main entry point (defined in `package.json:main`) must be the bundled file and must expose a React component as the **default export** and a **metadata object** as a **named export**.

| Export | Type | Description |
|--------|------|-------------|
| `default` | `React.Component` | The root component that renders the panel UI. |
| `metadata` | `Object` | Required information for the Host UI (Name, ID, Icon). |

#### Example `panel.bundle.js` Logic (Conceptual):

```javascript
// ... All bundled code for the panel's logic and dependencies ...

const PanelComponent = () => <h1>Hello from Custom Panel!</h1>;

export const metadata = {
    id: 'my-publisher.awesome-panel',
    name: 'Awesome Tool Panel',
    icon: '🚀'
};

export default PanelComponent;
```

### 3.3 Build Configuration (Developer Mandatory Action)

The panel developer's bundler (Webpack/Rollup) MUST be configured to:

- **Target:** Output a UMD or ESM bundle suitable for the browser/Node.js environment.
- **Externalize:** Explicitly mark `react` and `react-dom` as external.
- **Bundle:** Include all other libraries listed in `dependencies` directly into the final bundle (`dist/panel.bundle.js`).

---

## 4. Runtime Loading Mechanisms

The Host Application will use environment-specific logic to load the bundle.

### 4.1 Electron Runtime Loading (Production)

This requires Node's file system path resolution.

**Main Process:** When the Electron app starts, the Main Process iterates through the list of installed panel NPM packages.

- It uses `require.resolve('package-name')` to get the root path of the installed package in `node_modules`.
- It constructs the absolute path to the bundle: `path.join(packageRoot, 'dist', 'panel.bundle.js')`.
- It passes this absolute file path to the Renderer process via IPC.

**Renderer Process:** The Panel Loader component receives the absolute path.

```javascript
// In Renderer (Node integration enabled)
const loadComponent = (bundlePath) => {
    // Dynamic import using the local file path
    return import(bundlePath);
};
```

### 4.2 Web UI Runtime Loading (Development/Testing)

This relies on the development bundler's ability to resolve NPM package names.

**Development Environment:** The testing environment runs in a standard browser context with the panels installed locally (`npm install`).

**Direct Import:** The Panel Loader component uses a direct package name import.

```javascript
// In Web UI Dev Environment (Standard bundler resolution)
const loadComponent = (packageName) => {
    // Bundler resolves 'package-name' -> node_modules/package-name/dist/panel.bundle.js
    return import(packageName);
};
```

---

## 5. Security and Liability Model

Since sandboxing is omitted, we must strictly define the security model.

### Execution Risk

Any panel installed runs with the same high-level privileges as the main Electron application. Malicious code could:
- Access the user's file system (`fs`)
- Run operating system commands (`child_process`)
- Access environment variables

### Mitigation (Vetting)

**Official Store:** If an official Panel Store is created, rigorous security and dependency vetting (audit of `package.json` and code review) must be performed on all submissions before publication.

**User Responsibility:** All documentation must clearly state that installing third-party panels outside of the official store (if one exists) is done entirely at the user's risk, and the Host Application owner assumes no liability for damages caused by the extension's code.

---

## 6. Related Documentation

- [Terminal Panel V2 Deprecation Plan](./TERMINAL_PANEL_V2_DEPRECATION_PLAN.md)

---

**Last Updated:** October 25, 2025
