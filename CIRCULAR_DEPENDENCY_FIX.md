# Circular Dependency Fix - Package Updates Required

**Issue:** JavaScript heap out of memory during build due to multiple versions of the same packages being installed, creating circular dependencies.

**Date:** 2026-01-28

---

## Root Cause Analysis

The heap overflow is caused by multiple instances of:
1. `@principal-ai/principal-view-core` (versions: 0.12.2, 0.13.4, 0.13.5, 0.15.0, 0.15.2, 0.15.3)
2. `@principal-ai/repository-abstraction` (versions: 0.2.5, 0.2.6, 0.4.0, 0.5.1)

This creates duplicate module instances and circular references that exhaust the heap during webpack builds.

---

## Packages That Need Updating

### 1. **@industry-theme/repository-composition-panels** (v0.2.51)

**Current Dependencies:**
- `@principal-ai/principal-view-core`: `^0.12.2` ❌
- `@principal-ai/principal-view-react`: `^0.8.0` ❌
- `@principal-ai/repository-abstraction`: `^0.5.0` ⚠️ (version is correct, but pulls in wrong peer deps)

**Should Be:**
- `@principal-ai/principal-view-core`: `^0.15.3` ✅
- `@principal-ai/principal-view-react`: `^0.10.0` ✅
- `@principal-ai/repository-abstraction`: `^0.5.1` ✅

**Priority:** 🔴 HIGH - Major contributor to version conflicts

---

### 2. **@industry-theme/principal-view-panels** (v0.6.3)

**Current Dependencies:**
- `@principal-ai/principal-view-core`: `^0.15.3` ✅
- `@principal-ai/principal-view-react`: `^0.10.0` ✅
- `@principal-ai/repository-abstraction`: `0.2.5` ❌ (pinned, not using ^)

**Should Be:**
- `@principal-ai/principal-view-core`: `^0.15.3` ✅
- `@principal-ai/principal-view-react`: `^0.10.0` ✅
- `@principal-ai/repository-abstraction`: `^0.5.1` ✅

**Priority:** 🔴 HIGH - Pinned old version of repository-abstraction

---

### 3. **@industry-theme/agent-panels** (v0.2.25)

**Current Dependencies:**
- `@principal-ai/repository-abstraction`: `^0.4.0` ❌

**Should Be:**
- `@principal-ai/repository-abstraction`: `^0.5.1` ✅

**Priority:** 🟡 MEDIUM

---

### 4. **@industry-theme/alexandria-docs-panel** (v0.4.28)

**Current Dependencies:**
- `@principal-ai/repository-abstraction`: `^0.2.4` ❌

**Should Be:**
- `@principal-ai/repository-abstraction`: `^0.5.1` ✅

**Priority:** 🟡 MEDIUM

---

### 5. **@industry-theme/file-city-panel** (v0.2.56)

**Current Dependencies:**
- `@principal-ai/repository-abstraction`: `^0.5.0` ✅

**Should Be:**
- `@principal-ai/repository-abstraction`: `^0.5.1` ✅

**Priority:** 🟢 LOW - Already close, just needs version bump

---

## Additional Issue

### **@principal-ai/repository-abstraction** (v0.5.0 and v0.5.1)

**Current Peer Dependency:**
- `globby`: `^14.0.0` ❌

**Should Be:**
- `globby`: `^14.0.0 || ^16.0.0` ✅

**Reason:** The electron-app uses `globby@^16.0.0`, but repository-abstraction requires `^14.0.0`, causing peer dependency warnings.

**Priority:** 🟢 LOW - Currently bypassed with `--legacy-peer-deps`, but should be fixed for cleaner installs

---

## Summary of Required Actions

### Immediate (to fix heap overflow):

1. **Update @industry-theme/repository-composition-panels**
   - Bump `@principal-ai/principal-view-core` to `^0.15.3`
   - Bump `@principal-ai/principal-view-react` to `^0.10.0`
   - Bump `@principal-ai/repository-abstraction` to `^0.5.1`

2. **Update @industry-theme/principal-view-panels**
   - Change `@principal-ai/repository-abstraction` from `0.2.5` to `^0.5.1`

### Secondary (to clean up all conflicts):

3. **Update @industry-theme/agent-panels**
   - Bump `@principal-ai/repository-abstraction` to `^0.5.1`

4. **Update @industry-theme/alexandria-docs-panel**
   - Bump `@principal-ai/repository-abstraction` to `^0.5.1`

5. **Update @industry-theme/file-city-panel**
   - Bump `@principal-ai/repository-abstraction` to `^0.5.1`

### Optional (for cleaner installs):

6. **Update @principal-ai/repository-abstraction**
   - Change `globby` peer dependency to accept both `^14.0.0` and `^16.0.0`

---

## Verification Steps

After updating the packages, verify the fix with:

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Check for duplicate versions
npm ls @principal-ai/principal-view-core
npm ls @principal-ai/repository-abstraction

# Both should show minimal duplicate versions (ideally just one version each)
```

---

## Expected Outcome

After these updates, you should have:
- Single version of `@principal-ai/principal-view-core@^0.15.3`
- Single version of `@principal-ai/repository-abstraction@^0.5.1`
- No more heap overflow errors during build
- Successful builds without `--max-old-space-size` flags
