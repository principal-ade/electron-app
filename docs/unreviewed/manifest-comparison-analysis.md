# Extension Manifest Comparison Analysis

## Overview
This document compares our proposed extension manifest structure with VSCode and OpenVSX standards to identify alignment and divergence points.

## Alignment Analysis

### ✅ Strong Alignment (Direct Match)

| Field | Our Design | VSCode/OpenVSX | Status |
|-------|------------|----------------|---------|
| `name` | ✓ | ✓ | **Identical** |
| `displayName` | ✓ | ✓ | **Identical** |
| `version` | ✓ | ✓ | **Identical** |
| `description` | ✓ | ✓ | **Identical** |
| `publisher` | ✓ | ✓ | **Identical** |
| `categories` | ✓ | ✓ | **Identical** |
| `icon` | ✓ | ✓ | **Identical** |
| `main` | ✓ | ✓ | **Identical** |
| `activationEvents` | ✓ | ✓ | **Identical** |
| `contributes.commands` | ✓ | ✓ | **Identical** |
| `contributes.configuration` | ✓ | ✓ | **Identical** |
| `contributes.keybindings` | ✓ | ✓ | **Identical** |
| `contributes.menus` | ✓ | ✓ | **Identical** |
| `contributes.views` | ✓ | ✓ | **Identical** |

### 🔄 Partial Alignment (Needs Adjustment)

| Field | Our Design | VSCode/OpenVSX | Difference |
|-------|------------|----------------|------------|
| `engines` | `"electron-app": "^1.0.0"` | `"vscode": "^1.74.0"` | Different platform identifier |
| `extensionKind` | `["workspace"]` | `["ui", "workspace", "web"]` | VSCode has more options |
| `license` | Not specified | Required for OpenVSX | **Must add for OpenVSX compatibility** |

### ⚠️ Custom Fields (Not in VSCode)

| Field | Purpose | Impact |
|-------|---------|--------|
| `permissions` | Granular security model | **Extension to VSCode model** |
| `$schema` | JSON validation | Optional enhancement |

### ❌ Missing VSCode Fields

| VSCode Field | Purpose | Should We Add? |
|--------------|---------|----------------|
| `browser` | Web extension entry point | No (Electron-specific) |
| `extensionDependencies` | Depend on other extensions | **Yes - Important** |
| `extensionPack` | Bundle multiple extensions | Yes - Nice to have |
| `sponsor` | Funding information | Optional |
| `preview` | Mark as preview | Optional |
| `badges` | Display badges | Optional |
| `markdown` | Markdown engine config | Optional |
| `scripts.vscode:prepublish` | Pre-publish hook | **Yes - Important** |

## Recommendations for Full Compatibility

### 1. Adopt VSCode's Package.json Structure

```json
{
  // Standard NPM fields (100% compatible)
  "name": "storybook-extension",
  "displayName": "Storybook Development Server",
  "description": "Run and manage Storybook development server",
  "version": "1.0.0",
  "publisher": "your-publisher",
  "license": "MIT",  // Required for OpenVSX

  // VSCode standard fields
  "engines": {
    "vscode": "^1.74.0",  // Keep for compatibility
    "electron-app": "^1.0.0"  // Add our platform
  },

  "categories": ["Other"],
  "icon": "icon.png",
  "main": "./dist/extension.js",

  "activationEvents": [
    "onCommand:storybook.start",
    "workspaceContains:package.json"
  ],

  "contributes": {
    // Standard VSCode contributions
    "commands": [...],
    "configuration": {...},
    "menus": {...},
    "keybindings": [...]
  },

  // Our custom extension (separate file or embedded)
  "electron-app": {
    "permissions": [
      "windows.create",
      "process.spawn"
    ],
    "capabilities": {
      "untrustedWorkspaces": false
    }
  }
}
```

### 2. Use Separate Manifest for Advanced Features

Create a dual-manifest approach:

**package.json** (VSCode/OpenVSX compatible):
```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "engines": { "vscode": "^1.74.0" },
  // Standard VSCode fields only
}
```

**electron-app.json** (Our custom features):
```json
{
  "extends": "./package.json",
  "permissions": ["windows.create", "process.spawn"],
  "sandboxOptions": {...}
}
```

### 3. Runtime Detection Strategy

```typescript
// Extension entry point
export async function activate(context: ExtensionContext) {
  // Detect runtime environment
  if (isElectronApp()) {
    // Use our enhanced API
    const api = context as ElectronExtensionContext;
    api.windows.create({...});
  } else if (isVSCode()) {
    // Use VSCode API
    vscode.window.createWebviewPanel(...);
  }
}
```

## Migration Path

### Phase 1: Maintain Compatibility
- Use standard `package.json` structure
- Add our fields under custom namespace
- Maintain VSCode API compatibility layer

### Phase 2: Enhanced Features
- Detect Electron app environment
- Enable additional capabilities when available
- Graceful degradation in VSCode

### Phase 3: Extension Marketplace
- Support both VSCode Marketplace and OpenVSX
- Publish with appropriate manifests
- Document platform-specific features

## Benefits of Alignment

1. **Ecosystem Compatibility**: Extensions work in both environments
2. **Developer Familiarity**: VSCode developers can easily migrate
3. **Marketplace Access**: Can publish to existing marketplaces
4. **Tooling Reuse**: Can use existing VSCode extension tools (vsce, ovsx)

## Implementation Recommendations

### Must Have (For Compatibility)
- ✅ Use `package.json` as primary manifest
- ✅ Support VSCode's `contributes` structure
- ✅ Support VSCode's `activationEvents`
- ✅ Add `license` field for OpenVSX
- ✅ Support `extensionDependencies`

### Should Have (Enhanced Features)
- 🔧 Add permissions under custom namespace
- 🔧 Support dual-runtime detection
- 🔧 Maintain API compatibility layer

### Nice to Have (Future)
- 📋 Support extension packs
- 📋 Support preview flag
- 📋 Support badges and sponsorship

## Conclusion

Our design is **~85% aligned** with VSCode/OpenVSX standards. With minor adjustments:
1. Moving custom fields to a namespace
2. Adding missing required fields (license)
3. Using package.json as the primary manifest

We can achieve **100% compatibility** while maintaining our enhanced features through:
- Progressive enhancement (detect and use advanced features when available)
- Graceful degradation (work in standard VSCode when our features unavailable)
- Clear documentation of platform-specific capabilities

This approach allows us to:
- Accept existing VSCode extensions with zero modifications
- Enhance extensions with our platform-specific features
- Publish our extensions back to VSCode Marketplace/OpenVSX