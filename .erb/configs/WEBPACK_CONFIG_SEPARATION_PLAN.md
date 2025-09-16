# Webpack Configuration Separation Plan

## Currently Active Configurations (Used by working commands)

### Core Files (Always Used)
```
.erb/configs/
├── webpack.paths.ts                    # Path definitions
├── webpack.config.base.ts              # Base configuration
├── webpack.config.main.base.ts         # Main process base
├── webpack.config.renderer.base.ts     # Renderer process base
├── process-polyfill-loader.js          # Custom loader
└── events-polyfill-fix.js              # Polyfill utility
```

### Development (`npm run dev`)
```
.erb/configs/
├── webpack.config.renderer.dev.dll.standalone.ts  # DLL bundle
├── webpack.config.main.dev.ts                     # Main process
└── webpack.config.renderer.dev.standalone.ts      # Renderer
```

### Production (`npm run package:mac:npm`)
```
.erb/configs/
├── webpack.config.main.prod.ts              # Main process
└── webpack.config.renderer.prod.standalone.ts  # Renderer
```

## Potentially Unused Configurations

### Windows-Specific (Not used on macOS)
```
.erb/configs/
├── webpack.config.renderer.dev.dll.windows.ts   # Windows DLL
├── webpack.config.renderer.dev.windows.ts       # Windows dev renderer
└── webpack.config.renderer.prod.windows.ts      # Windows prod renderer
```

### Alternative Configurations
```
.erb/configs/
├── webpack.config.renderer.dev.nohmr.ts    # No HMR variant (unused)
├── webpack.config.preload.dev.ts           # Preload script (check if used)
└── webpack.config.eslint.ts                # ESLint reference
```

## Recommended Separation Strategy

### Option 1: Directory-Based Separation
```
.erb/configs/
├── active/                              # Currently used configs
│   ├── core/                           # Base configs and utilities
│   │   ├── webpack.paths.ts
│   │   ├── webpack.config.base.ts
│   │   ├── webpack.config.main.base.ts
│   │   ├── webpack.config.renderer.base.ts
│   │   ├── process-polyfill-loader.js
│   │   └── events-polyfill-fix.js
│   ├── development/                    # Dev configs
│   │   ├── webpack.config.main.dev.ts
│   │   ├── webpack.config.renderer.dev.dll.standalone.ts
│   │   └── webpack.config.renderer.dev.standalone.ts
│   └── production/                     # Prod configs
│       ├── webpack.config.main.prod.ts
│       └── webpack.config.renderer.prod.standalone.ts
└── archived/                           # Unused/legacy configs
    ├── windows/                        # Windows-specific
    │   ├── webpack.config.renderer.dev.dll.windows.ts
    │   ├── webpack.config.renderer.dev.windows.ts
    │   └── webpack.config.renderer.prod.windows.ts
    └── alternative/                    # Alternative approaches
        ├── webpack.config.renderer.dev.nohmr.ts
        ├── webpack.config.preload.dev.ts
        └── webpack.config.eslint.ts
```

### Option 2: Naming Convention
Rename files to clearly indicate their status:
- Active configs: Keep current names
- Unused configs: Prefix with `_archived_` or `_unused_`

### Option 3: Separate Branch/Tag
1. Create a branch/tag with all current configs for reference
2. Remove unused configs from main branch
3. Document removed configs in README

## Implementation Steps

1. **Verify Preload Script Usage**
   - Check if `webpack.config.preload.dev.ts` is actually used
   - The main.dev.ts builds both main and preload, so this might be redundant

2. **Test Windows Configs (if needed)**
   - If Windows support is planned, test these configs
   - Otherwise, move to archived

3. **Update Build Scripts**
   - Ensure all npm scripts reference correct paths after reorganization
   - Update any import statements in configs

4. **Document Changes**
   - Update main README with config structure
   - Add README in archived folder explaining each config's original purpose

5. **Clean Up Dependencies**
   - Review if any webpack plugins are only used by unused configs
   - Remove unnecessary dependencies

## Benefits of Separation

1. **Clarity**: Easier to understand which configs are actually used
2. **Maintenance**: Less confusion when updating build process
3. **Performance**: Potentially faster dependency installation without unused plugins
4. **Documentation**: Clear separation helps new developers understand the build

## Risks and Mitigation

1. **Risk**: May need Windows configs later
   - **Mitigation**: Keep in archived folder with documentation

2. **Risk**: Breaking import paths
   - **Mitigation**: Test all build commands after reorganization

3. **Risk**: Missing indirect usage
   - **Mitigation**: Run full test suite including packaging