# Font Style Hardcoding Analysis - Priority Panels

## Executive Summary

Analyzed 9 priority panel components for hardcoded font styles (fontSize, fontFamily, fontWeight).
**Total issues found: 135 hardcoded instances across all panels**

The top 3 worst offenders account for 78 instances (58% of all hardcoded styles).

---

## Detailed Results (Ranked by Total Hardcoded Styles)

### 1. TerminalDebugModal.tsx - **33 instances** (HIGHEST PRIORITY)
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/TerminalDebugModal.tsx`

**Breakdown:**
- fontSize (string literals): 19 instances
- fontFamily (hardcoded): 4 instances
- fontWeight (numeric): 10 instances

**Hardcoded Values Found:**
- fontSize: '18px', '14px', '12px', '11px', '10px'
- fontFamily: 'monospace' (appears multiple times)
- fontWeight: 600, 500 (numeric values)

**Key Lines:**
- Line 182: `fontSize: '18px'`
- Line 183: `fontWeight: 600`
- Line 208, 276, 346, 547: `fontSize: '12px'` and `fontWeight: 600` (h2/h3 headers)
- Line 294, 319, 418, 565: `fontFamily: 'monospace'`
- Lines 433-465: Multiple `fontSize: '10px'` and `fontWeight: 600` badges

**Impact:** Modal appears frequently in terminal debugging workflows. Changes to theme require manual updates here.

---

### 2. AgentEventsPanel.tsx - **32 instances** (CRITICAL)
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/AgentEventsPanel.tsx`

**Breakdown:**
- fontSize (string literals): 20 instances
- fontFamily (hardcoded): 3 instances
- fontWeight (numeric): 9 instances

**Hardcoded Values Found:**
- fontSize: '14px', '12px', '11px', '10px'
- fontFamily: 'monospace' (lines 670, 727, 759)
- fontWeight: 600, 500 (numeric values)

**Key Lines:**
- Line 282: `fontWeight: 600, fontSize: '14px'` (header)
- Lines 287, 307, 364, 390: Multiple `fontSize: '12px'`
- Lines 565-566, 582: Event type labels with `fontSize: '11px'` and `fontWeight: 600`
- Line 670: `fontFamily: 'monospace', fontSize: '11px'` (session ID display)
- Lines 726-727, 759: Multiple instances of monospace font for file paths

**Impact:** High-traffic panel with many visual elements. Fonts hardcoded across event types, metadata, and file path displays.

---

### 3. QualityHexagonPanel.tsx - **14 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/QualityHexagonPanel.tsx`

**Breakdown:**
- fontSize (string literals): 3 instances
- fontFamily (hardcoded): 4 instances
- fontWeight (numeric): 7 instances

**Hardcoded Values:**
- fontSize: '16px', '14px'
- fontFamily: 'monospace', 'sans-serif', etc.
- fontWeight: 600, 500, 700

---

### 4. GitCommitHistoryPanel.tsx - **13 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitCommitHistoryPanel.tsx`

**Breakdown:**
- fontSize (string literals): 6 instances
- fontFamily (hardcoded): 3 instances
- fontWeight (numeric): 4 instances

**Hardcoded Values:**
- Lines 145, 243, 247, 252: `fontSize: '12px'` or `'11px'` or `'10px'`
- Lines 246, 328: `fontFamily: theme.fonts.monospace` (mixed approach)
- fontWeight: 500, 600

**Notable:** Mix of theme-based and hardcoded values - inconsistent approach.

---

### 5. GitIssuesPanel.tsx - **11 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitIssuesPanel.tsx`

**Breakdown:**
- fontSize (string literals): 7 instances
- fontFamily: 0 instances
- fontWeight (numeric): 4 instances

**Hardcoded Values:**
- fontSize: '16px', '14px', '13px', '12px', '11px'
- fontWeight: 600, 500

---

### 6. GitPullRequestsPanel.tsx - **11 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitPullRequestsPanel.tsx`

**Breakdown:**
- fontSize (string literals): 7 instances
- fontFamily: 0 instances
- fontWeight (numeric): 4 instances

**Similar to GitIssuesPanel** - nearly identical structure and font hardcoding.

---

### 7. ToolsPanel.tsx - **11 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/ToolsPanel.tsx`

**Breakdown:**
- fontSize (string literals): 1 instance
- fontFamily (hardcoded): 2 instances
- fontWeight (numeric): 8 instances

**Hardcoded Values:**
- fontFamily: 'monospace', 'theme.fonts.monospace'
- fontWeight: 600, 500, 700

---

### 8. GitStatusPanel.tsx - **8 instances**
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitStatusPanel.tsx`

**Breakdown:**
- fontSize (string literals): 4 instances
- fontFamily: 1 instance
- fontWeight (numeric): 3 instances

**Hardcoded Values:**
- fontSize: '12px', '11px', '10px', '9px'
- fontFamily: 'monospace'
- fontWeight: 600, 500

---

### 9. FileTreePanelContent.tsx - **2 instances** (BEST)
**Location:** `/Users/griever/Developer/electron-app/src/renderer/panels/components/FileTreePanelContent.tsx`

**Breakdown:**
- fontSize (string literals): 1 instance
- fontFamily: 0 instances
- fontWeight (numeric): 1 instance

**Hardcoded Values:**
- fontSize: '12px'
- fontWeight: 600

**Status:** Already mostly using theme system. Minimal work needed.

---

## Patterns Observed

### Common Hardcoded Font Sizes
1. **'12px'** - Most common (appears ~50+ times across panels)
2. **'14px'** - Headers and primary text
3. **'11px'** - Secondary text and metadata
4. **'10px'** - Badges, small labels
5. **'9px'** - Smallest text (hash displays, etc.)

### Common Hardcoded Font Families
1. **'monospace'** - For code/hashes (appears in most panels)
2. **theme.fonts.monospace** - Mixed approach (inconsistent)

### Common Font Weights
- **600** - Most common (bold text, headers)
- **500** - Normal weight
- **700** - Extra bold (rare)

---

## Recommendations Priority Order

### Phase 1 - CRITICAL (Top 2 panels: 65 instances)
1. **TerminalDebugModal.tsx** - 33 instances
2. **AgentEventsPanel.tsx** - 32 instances

**Action:** Create/enhance theme system to support these font sizes and use theme variables throughout.

### Phase 2 - HIGH (Next 4 panels: 49 instances)
3. **QualityHexagonPanel.tsx** - 14 instances
4. **GitCommitHistoryPanel.tsx** - 13 instances
5. **GitIssuesPanel.tsx** - 11 instances
6. **GitPullRequestsPanel.tsx** - 11 instances

### Phase 3 - MEDIUM (Remaining panels: 21 instances)
7. **ToolsPanel.tsx** - 11 instances
8. **GitStatusPanel.tsx** - 8 instances
9. **FileTreePanelContent.tsx** - 2 instances (minimal work)

---

## Implementation Strategy

### Option A: Extend theme.fontSizes
Add granular font size support to theme:
```typescript
theme.fontSizes = {
  xs: '9px',
  sm: '10px',
  base: '12px',
  md: '14px',
  lg: '16px',
  xl: '18px',
  // ... more sizes as needed
}
```

### Option B: Create Typography System
Implement semantic typography classes:
```typescript
theme.typography = {
  h1: { fontSize: '18px', fontWeight: 600 },
  h2: { fontSize: '16px', fontWeight: 600 },
  h3: { fontSize: '14px', fontWeight: 600 },
  body: { fontSize: '12px', fontWeight: 400 },
  caption: { fontSize: '11px', fontWeight: 500 },
  code: { fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 },
}
```

### Option C: Hybrid Approach (RECOMMENDED)
Extend existing theme with standardized size constants AND typography helpers.

---

## Summary Statistics

| Panel | Total | fontSize | fontFamily | fontWeight |
|-------|-------|----------|-----------|-----------|
| TerminalDebugModal | 33 | 19 | 4 | 10 |
| AgentEventsPanel | 32 | 20 | 3 | 9 |
| QualityHexagonPanel | 14 | 3 | 4 | 7 |
| GitCommitHistoryPanel | 13 | 6 | 3 | 4 |
| GitIssuesPanel | 11 | 7 | 0 | 4 |
| GitPullRequestsPanel | 11 | 7 | 0 | 4 |
| ToolsPanel | 11 | 1 | 2 | 8 |
| GitStatusPanel | 8 | 4 | 1 | 3 |
| FileTreePanelContent | 2 | 1 | 0 | 1 |
| **TOTAL** | **135** | **68** | **17** | **50** |

**Percentage breakdown:**
- fontSize: 50.4% (mostly '12px', '14px', '11px')
- fontWeight: 37.0% (mostly 600, 500)
- fontFamily: 12.6% (mostly 'monospace')

