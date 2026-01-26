# Panel Framework Performance Optimization Guide

## Overview

This document describes performance issues discovered in the panel framework integration and the solutions implemented to prevent unnecessary re-renders.

## The Problem

Panel components were re-rendering excessively (7+ times in rapid succession) due to unstable object references in the `RepositoryPanelContext`. This caused:

- **Performance degradation**: Wasted CPU cycles on unnecessary re-renders
- **UI bugs**: Loss of hover states and interactive elements during re-renders
- **Poor user experience**: Janky interactions when hovering over panel elements

## Root Cause Analysis

### Issue 1: Unstable Data References

The `slices` Map in `RepositoryPanelContext` was recreating on every render because it depended on raw state objects that were getting new references even when their data hadn't changed:

```typescript
// ❌ BEFORE - Bad pattern
const slices = useMemo(
  () => new Map([
    ['fileTree', { data: fileTreeData, ... }],  // fileTreeData reference changes
    ['quality', { data: qualityData, ... }],     // qualityData reference changes
    // ...
  ]),
  [fileTreeData, qualityData, ...]  // Recreates when references change
);
```

### Issue 2: Unstable Callback Functions

Callback functions in the context were recreated on every render:

```typescript
// ❌ BEFORE - Bad pattern
const context = useMemo(
  () => ({
    getSlice: (name) => slices.get(name),  // New function every render
    refresh: async () => { ... },          // New function every render
  }),
  [slices]
);
```

### Issue 3: Unstable Nested Objects

The `currentScope` object was recreated on every render:

```typescript
// ❌ BEFORE - Bad pattern
const context = useMemo(
  () => ({
    currentScope: {                    // New object every render
      type: 'repository',
      repository,
    },
  }),
  [repository]
);
```

## The Solution

### 1. Use Stable Identifiers for Data Objects (With Natural IDs Only)

Extract stable identifiers (SHA, timestamp, ID) and only recreate objects when those identifiers change.

**IMPORTANT**: Only stabilize data that has **natural stable identifiers** built into the data structure. Don't create artificial hashes or use array length.

```typescript
// ✅ GOOD - Data with natural stable identifiers
const fileTreeSha = fileTreeData?.sha;                    // FileTree has SHA
const qualityDataTimestamp = qualityData?.lastUpdated;    // Quality data has timestamp
const activeFilePath = activeFileData?.path;              // Active file has path

// Create stable references
const stableFileTreeData = useMemo(() => fileTreeData, [fileTreeSha]);
const stableQualityData = useMemo(() => qualityData, [qualityDataTimestamp]);
const stableActiveFileData = useMemo(() => activeFileData, [activeFilePath]);
```

```typescript
// ❌ BAD - Don't stabilize arrays without natural IDs
const reposCount = repositories.length;  // Array length is not a stable ID!
const reposHash = repositories.map(r => r.name).join(',');  // Creates new hash every render!

const stableRepos = useMemo(() => repositories, [reposCount]);  // ❌ Stale data!
const stableRepos = useMemo(() => repositories, [reposHash]);   // ❌ Still unstable!
```

**Why not use array length or hashes?**
- Array length can be same with different contents → stale data
- Creating hashes in useMemo still creates new values every render → defeats the purpose
- Arrays should update naturally when their contents change

**When to stabilize:**
- ✅ Data has SHA, ID, timestamp, or unique identifier
- ✅ Identifier is already computed/stored in the data
- ❌ Would need to create hash/fingerprint on the fly
- ❌ Data is a simple array/object without natural ID

### 2. Memoize All Callback Functions

Use `useCallback` for all functions that are passed down through context:

```typescript
// ✅ AFTER - Good pattern
const getSlice = useCallback(
  (name: string) => slices.get(name),
  [slices]
);

const refresh = useCallback(
  async (scope, sliceName) => {
    // implementation
  },
  [slices]
);
```

### 3. Memoize Nested Objects

Create stable references for nested objects:

```typescript
// ✅ AFTER - Good pattern
const currentScope = useMemo(
  () => ({
    type: 'repository' as const,
    repository,
  }),
  [repository]
);

const context = useMemo(
  () => ({
    currentScope,  // Use memoized reference
    getSlice,      // Use memoized callback
    refresh,       // Use memoized callback
  }),
  [currentScope, getSlice, refresh]
);
```

## Implementation Checklist

When working with the panel framework context providers, follow this checklist:

### ✅ Data Stability
- [ ] Extract stable identifiers (SHA, timestamp, count, ID) from state objects
- [ ] Use `useMemo` to create stable references that only change when identifiers change
- [ ] Use stable references in slice data, not raw state

### ✅ Function Stability
- [ ] Wrap all context callback functions with `useCallback`
- [ ] Include only necessary dependencies in `useCallback` arrays
- [ ] Avoid creating new functions inside `useMemo` dependencies

### ✅ Object Stability
- [ ] Memoize nested objects (like `currentScope`, adapter objects, etc.)
- [ ] Use memoized objects in context instead of inline object literals
- [ ] Verify dependency arrays only include primitive values or stable references

## Audit Guide

To audit other context providers for similar issues:

### 1. Add Diagnostic Logging

Add this logging pattern to panel components to detect re-render issues:

```typescript
const renderCountRef = useRef(0);
const prevPropsRef = useRef<typeof props | null>(null);

renderCountRef.current += 1;

if (prevPropsRef.current) {
  const propsChanged = {
    context: prevPropsRef.current.context !== context,
    actions: prevPropsRef.current.actions !== actions,
    events: prevPropsRef.current.events !== events,
  };

  console.log(`[YourPanel] Render #${renderCountRef.current}`, propsChanged);
}

prevPropsRef.current = { context, actions, events };
```

### 2. Look for These Patterns

Search for these anti-patterns in context providers:

```bash
# Find useMemo with raw state dependencies
grep -A5 "useMemo" src/renderer/contexts/*.tsx | grep -E "(Data|data)\]"

# Find inline object/function creation in useMemo
grep -A10 "useMemo" src/renderer/contexts/*.tsx | grep -E "(\{|=>)"
```

### 3. Test for Rapid Re-renders

- Open DevTools Console
- Interact with panels (hover, click, type)
- Look for consecutive render logs with the same render count increasing
- **Red flag**: 3+ consecutive renders with no user interaction
- **Expected**: 1-2 renders per user interaction

## Files Changed

The following files were modified to fix panel re-render issues:

### Desktop App - CanvasListPanel Fix (Initial)
- `src/renderer/contexts/RepositoryPanelContext.tsx`
  - Added stable identifier extraction for data with natural IDs:
    - `fileTreeSha` from `fileTreeData?.sha`
    - `qualityDataTimestamp` from `qualityData?.lastUpdated`
    - `activeFilePath` from `activeFileData?.path`
  - Created stable references with useMemo (only for above data)
  - Converted context callbacks to useCallback:
    - `getSlice`, `getWorkspaceSlice`, `getRepositorySlice`
    - `hasSlice`, `isSliceLoading`, `refresh`
  - Memoized `currentScope` object
  - Updated fileTree, quality, and activeFile slice definitions to use stable references
  - **Did NOT stabilize**: arrays without natural IDs (repositories, skills, servers, packages)

### Desktop App - GitChangesPanel Fix (2026-01-25)
- `src/renderer/contexts/RepositoryPanelContext.tsx`
  - **Added git status hash stabilization**: Git status arrays don't have natural IDs, so compute a content hash
    - `gitStatusHash` - JSON.stringify sorted arrays to detect actual content changes
    - `stableGitStatusData` - memoized with gitStatusHash dependency
  - Updated git slice to use `stableGitStatusData` instead of raw `gitStatusData`
  - Updated `effectiveColorMode` to use `stableGitStatusData`
  - Updated slices useMemo dependencies to use `stableGitStatusData`

### Panel Package
- No permanent changes (diagnostic logging was added and removed)

## Performance Impact

**Before optimization:**
- 7+ re-renders per interaction
- Hover state lost during re-renders
- Context object recreated on every render
- FileTree slice recreated even when SHA unchanged

**After optimization:**
- 1 re-render per meaningful state change
- Hover state preserved
- Context object stable when data unchanged
- FileTree slice only recreates when SHA changes
- Tabs and navigation work correctly

**Key Insight:**
The fileTree SHA stabilization was the primary fix. Stabilizing callbacks and currentScope provided additional benefit. Arrays without natural IDs should update normally to prevent stale data issues.

## Related Resources

- [React useMemo documentation](https://react.dev/reference/react/useMemo)
- [React useCallback documentation](https://react.dev/reference/react/useCallback)
- [React.memo API](https://react.dev/reference/react/memo)

## Common Pitfalls

### Over-Stabilization

**Problem**: Trying to stabilize every piece of data, including arrays without natural IDs.

```typescript
// ❌ BAD - Over-stabilization attempt
const reposHash = useMemo(() =>
  repositories.map(r => `${r.name}:${r.path}`).join('|'),
  [repositories]  // Creates new hash every render anyway!
);
const stableRepos = useMemo(() => repositories, [reposHash]);
```

**Why it fails:**
- The hash calculation itself creates a new value every render
- You're just moving the instability, not fixing it
- Can cause stale data when array contents change but hash coincidentally stays same

**Solution**: Only stabilize data with built-in stable IDs. Let arrays update naturally.

### Using Array Length as Stable ID

**Problem**: Array length can be the same even when contents are completely different.

```typescript
// ❌ BAD - Same length, different data
const oldRepos = [repo1, repo2, repo3];  // length: 3
const newRepos = [repo4, repo5, repo6];  // length: 3 (same!)

const stableRepos = useMemo(() => repositories, [repositories.length]);
// Component gets stale data because length didn't change!
```

**Solution**: Don't use length as a stable identifier unless you're absolutely certain the length changing is the only relevant update.

### Stabilizing Everything

**Problem**: "If some stabilization is good, more must be better!"

**Reality**: Only stabilize what's causing the actual performance issue. The diagnostic logging showed only `fileTree`, `quality`, and `activeFile` had stable IDs. Everything else should update normally.

**Guideline**: Start with no stabilization, add diagnostic logging, identify the problem data, stabilize only that.

## Notes for Future Development

1. **Only stabilize data with natural IDs**: When adding new slices, only extract a stable identifier if one exists in the data (SHA, ID, timestamp). Don't create artificial hashes.
2. **Prefer primitive dependencies**: Use numbers/strings in dependency arrays, not objects/arrays
3. **Test with logging**: Add render count logging during development to catch issues early
4. **Don't rely on React.memo as a fix**: React.memo on child components is a workaround, not a solution - fix the root cause in context providers
5. **Audit periodically**: Re-run the audit checklist quarterly or when adding new context providers
6. **Test functionality after optimization**: Performance fixes should not break features - always verify clicks, navigation, and data updates still work

---

**Last Updated**: 2026-01-25
**Issue Fixed**: CanvasListPanel excessive re-renders causing hover state loss
