# Repository Abstraction Peer Dependency Migration

**Goal:** Convert all packages to use `@principal-ai/repository-abstraction` as a peer dependency instead of a regular dependency to eliminate duplicate versions and fix circular dependency heap overflow.

**Target Version:** `^0.5.2`

**Date Started:** 2026-01-28

---

## ✅ Completed Packages

### Panel Packages (5/5)
- ✅ **@industry-theme/principal-view-panels@0.6.6** - Updated, published by team
- ✅ **@industry-theme/repository-composition-panels@0.2.52** - Published
- ✅ **@industry-theme/agent-panels@0.2.26** - Published
- ✅ **@industry-theme/alexandria-docs-panel@0.4.29** - Published
- ✅ **@industry-theme/file-city-panel@0.2.57** - Published

### Core Packages (1/1)
- ✅ **@principal-ade/panel-framework-core@0.3.0** - Published (BREAKING: minor bump due to peer dep change)

---

## 🔴 HIGH PRIORITY - Core Libraries

These packages are widely used and cause the most duplication. Update these first.

### 1. @principal-ai/principal-view-core
**Current Version:** 0.15.3
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.2.6`
**Path:** Need to locate
**Used By:** Many packages including principal-view-panels, repository-composition-panels
**Action:**
- Move `repository-abstraction` to `peerDependencies: "^0.5.2"`
- Add to `devDependencies: "^0.5.2"`
- Version bump: minor (0.15.3 → 0.16.0)

### 2. @principal-ai/principal-view-react
**Current Version:** 0.10.1
**Current Dependency:** Unknown (but likely has repository-abstraction)
**Path:** Need to locate
**Used By:** principal-view-panels
**Action:**
- Check if it has repository-abstraction as dependency
- If yes, move to peer dependency
- Version bump: minor

### 3. @principal-ai/alexandria-core-library
**Current Versions:** 0.1.47, 0.3.2 (multiple versions in tree!)
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.2.6`
**Path:** Need to locate
**Used By:** file-city-builder, alexandria-docs-panel, file-city-react
**Action:**
- Move `repository-abstraction` to `peerDependencies: "^0.5.2"`
- Add to `devDependencies: "^0.5.2"`
- Version bump: minor for both versions

### 4. @principal-ai/codebase-composition
**Current Version:** 0.2.41
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.2.6`
**Path:** Need to locate
**Used By:** Multiple panels
**Action:**
- Move `repository-abstraction` to `peerDependencies: "^0.5.2"`
- Add to `devDependencies: "^0.5.2"`
- Version bump: minor (0.2.41 → 0.3.0)

### 5. @principal-ai/file-city-builder
**Current Version:** 0.3.0
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.2.6`
**Path:** Need to locate
**Used By:** file-city-panel
**Action:**
- Move `repository-abstraction` to `peerDependencies: "^0.5.2"`
- Add to `devDependencies: "^0.5.2"`
- Version bump: minor (0.3.0 → 0.4.0)

---

## 🟡 MEDIUM PRIORITY - Panel Packages Using Old panel-framework-core

These packages are using old versions of panel-framework-core (0.1.10 or 0.2.0). They need to update to ^0.3.0.

### Panel Packages with panel-framework-core@0.1.10

| Package | Current Version | Path | Action |
|---------|----------------|------|--------|
| @industry-theme/agent-driven-ui-panels | 0.1.0 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/alexandria-panels | 0.1.36 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/file-editing-panels | 0.3.12 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/ghostty-terminal-panel | 0.1.18 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/git-sync-panels | 0.1.4 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/github-panels | 0.1.59 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/localhost-panels | 0.1.7 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @industry-theme/markdown-panels | 0.2.23 | Need to locate | Update panel-framework-core to ^0.3.0 |
| @principal-ade/code-quality-panels | 0.1.27 | Need to locate | Update panel-framework-core to ^0.3.0 |

### Panel Packages with panel-framework-core@0.2.0

These have already been partially updated but are still on 0.2.0 instead of 0.3.0:

| Package | Current Version | Path | Action |
|---------|----------------|------|--------|
| @industry-theme/xterm-terminal-panel | 0.3.6 | Need to locate | Update panel-framework-core to ^0.3.0 |

**Note:** The packages we already updated (principal-view-panels@0.6.6, repository-composition-panels@0.2.52) also show panel-framework-core@0.2.0 in the dependency tree. They may need to update to 0.3.0 as well, or npm is resolving to an older cached version.

---

## 🟢 LOW PRIORITY - Other Packages

### 1. @backlog-md/core
**Current Version:** 0.3.7
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.4.0`
**Path:** External package (not maintained by us?)
**Used By:** backlogmd-kanban-panel
**Action:**
- If we maintain this: Move to peer dependency
- If external: Request update or wait for upstream fix

### 2. @principal-ade/dynamic-file-tree
**Current Version:** 0.1.50
**Current Dependency:** `@principal-ai/repository-abstraction: ^0.2.3`
**Path:** Need to locate
**Used By:** alexandria-docs-panel, file-city-panel
**Action:**
- Move `repository-abstraction` to `peerDependencies: "^0.5.2"`
- Add to `devDependencies: "^0.5.2"`
- Version bump: minor (0.1.50 → 0.2.0)

---

## 📋 Migration Checklist

### Phase 1: Core Libraries (HIGH PRIORITY)
- [ ] Locate package paths for all core libraries
- [ ] Update @principal-ai/principal-view-core
- [ ] Update @principal-ai/principal-view-react
- [ ] Update @principal-ai/alexandria-core-library (both versions)
- [ ] Update @principal-ai/codebase-composition
- [ ] Update @principal-ai/file-city-builder
- [ ] Publish all core library updates
- [ ] Test in electron-app

### Phase 2: Panel Framework Consumers (MEDIUM PRIORITY)
- [ ] Locate package paths for all panel packages
- [ ] Update all packages using panel-framework-core@0.1.10 to ^0.3.0
- [ ] Update packages using panel-framework-core@0.2.0 to ^0.3.0
- [ ] Verify no packages are pinned to old panel-framework-core versions
- [ ] Publish all panel updates
- [ ] Test in electron-app

### Phase 3: Cleanup (LOW PRIORITY)
- [ ] Update @principal-ade/dynamic-file-tree
- [ ] Check if @backlog-md/core is maintained by us
- [ ] Final verification in electron-app
- [ ] Update electron-app to latest versions of all packages
- [ ] Run build without --max-old-space-size flag
- [ ] Verify single version of repository-abstraction

### Phase 4: Final Verification
- [ ] Clean install in electron-app
- [ ] Run `npm ls @principal-ai/repository-abstraction` - should show mostly 0.5.2
- [ ] Run `npm ls @principal-ai/principal-view-core` - should show single version
- [ ] Build without memory flags: `npm run build:renderer:unix`
- [ ] Verify no heap overflow errors
- [ ] Update CIRCULAR_DEPENDENCY_FIX.md with results
- [ ] Archive this migration document

---

## Commands for Each Package

When updating a package, follow this pattern:

```bash
# 1. Make the package.json changes
# Move from dependencies to peerDependencies and devDependencies

# 2. Build
bun run build  # or npm run build

# 3. Commit
git add package.json
git commit -m "chore: move repository-abstraction to peer dependency

- Move @principal-ai/repository-abstraction to peerDependencies and devDependencies
- Update to ^0.5.2
- Prevents multiple versions in consuming apps

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 4. Version bump (use 'minor' for breaking peer dep changes)
npm version minor

# 5. Publish
npm publish

# 6. Push
git push && git push --tags
```

---

## Expected Outcome

After all updates:
- ✅ Single version of `@principal-ai/repository-abstraction@0.5.2` in electron-app
- ✅ Single version of `@principal-ai/principal-view-core@latest`
- ✅ No heap overflow during builds
- ✅ Successful builds without `--max-old-space-size=8192` flag
- ✅ Cleaner dependency tree
- ✅ Faster npm installs

---

## Notes

- All packages moving repository-abstraction to peer dependencies should use **minor version bumps** since this is a breaking change for consumers
- Use `^0.5.2` for the peer dependency range to allow future patches
- Always add to both `peerDependencies` AND `devDependencies` (for Storybook/local dev)
- Test each package's build before publishing
- Update electron-app incrementally to catch issues early
