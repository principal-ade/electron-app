# Font Theme Refactor - Tracking Document

## Overview
This document tracks UI components that are setting font properties without using the theme object. The goal is to refactor all hardcoded font properties to use theme values for consistency and maintainability.

## Theme Properties Reference
```typescript
// Use these instead of hardcoded values:
theme.fonts.monospace        // Instead of fontFamily: 'monospace'
theme.fonts.body             // For regular text
theme.fontSizes[0-5]         // Instead of 11px, 12px, 13px, etc.
theme.fontWeights.medium     // Instead of 500
theme.fontWeights.semibold   // Instead of 600
theme.fontWeights.bold       // Instead of 700 or 'bold'
```

---

## High Priority Files (15+ instances)

### [ ] src/renderer/panels/components/ToolsPanel.tsx
**Issue Count:** 15+ hardcoded font properties
**Lines:** 370, 371, 417, 423, 477, 483, 499, 553, 606, 642, 721
**Problems:**
- Hardcoded fontSize: 11, 12, 13, 14, 16
- Hardcoded fontWeight: 600

**Before:**
```typescript
style={{ fontSize: 16, marginBottom: 8 }}
style={{ fontWeight: 600, fontSize: 14 }}
```

**After:**
```typescript
style={{ fontSize: theme.fontSizes[3], marginBottom: 8 }}
style={{ fontWeight: theme.fontWeights.semibold, fontSize: theme.fontSizes[2] }}
```

---

### [x] src/renderer/repo-manager/panels/ExcalidrawPanel.tsx ✅
**Issue Count:** 11 hardcoded font properties
**Lines:** 284, 285, 293, 312, 381, 422, 423, 437, 438, 459, 476
**Problems:**
- Lines 284, 422, 437: `fontSize: '13px'` → Fixed to `theme.fontSizes[2]`
- Lines 285, 423, 438: `fontWeight: 600` → Fixed to `theme.fontWeights.semibold`
- Lines 293, 459: `fontSize: '11px'` → Fixed to `theme.fontSizes[0]`
- Lines 312, 381, 476: `fontSize: '12px'` → Fixed to `theme.fontSizes[1]`

---

### [ ] src/renderer/unused/RepositorySettingsModal.tsx
**Issue Count:** 15+ hardcoded font properties
**Lines:** 313, 364, 407, 434, 479, 536, 558, 617, 635, 733, 788, 803, 926, 945, 962, 1000
**Problems:**
- Hardcoded fontWeight values
- Hardcoded fontFamily: 'monospace' at line 803

**Note:** This file is in the `unused` directory - consider if it needs updating or can be deleted

---

### [ ] src/renderer/styles/mdx-editor.ts
**Issue Count:** Complete CSS refactor needed
**Lines:** 18-62
**Problems:**
- CSS template strings with hardcoded font-size and font-weight for all heading levels
- h1: `font-size: 2em !important; font-weight: 700 !important;`
- h2: `font-size: 1.5em !important; font-weight: 600 !important;`
- h3: `font-size: 1.25em !important; font-weight: 600 !important;`

**Needs:** Complete refactor to use theme values in styled-components or CSS-in-JS

---

### [x] src/renderer/components/repository-maps/IssuesTab.tsx ✅
**Issue Count:** 19 fontWeight + 35 fontSize instances = 54 total
**Lines:** Multiple throughout the file
**Problems:**
- **fontWeight (19 instances):**
  - Lines 454, 509, 536, 625, 663, 820, 839, 963, 1103, 1138, 1170, 1203, 1287, 1410: `fontWeight: 600` → Fixed to `theme.fontWeights.semibold`
  - Lines 690, 939, 1027, 1050, 1385: `fontWeight: 500` → Fixed to `theme.fontWeights.medium`
  - Line 454: Ternary `? 600 : 400` → Fixed to `? theme.fontWeights.semibold : 400`
- **fontSize (35 instances):**
  - `fontSize: '11px'` (2 instances) → Fixed to `theme.fontSizes[0]`
  - `fontSize: '12px'` (5 instances) → Fixed to `theme.fontSizes[1]`
  - `fontSize: '13px'` (4 instances) → Fixed to `theme.fontSizes[2]`
  - `fontSize: '14px'` (22 instances) → Fixed to `theme.fontSizes[2]`
  - `fontSize: '15px'` (1 instance) → Fixed to `theme.fontSizes[3]`
  - `fontSize: '20px'` (2 instances) → Fixed to `theme.fontSizes[4]`

---

## Medium Priority Files (4-10 instances)

### [ ] src/renderer/principal-window/views/AuthView/components/AuthDetails.tsx
**Issue Count:** 5 instances
**Lines:** 631, 864, 1540, 1708, 2143
**Problems:**
- Line 631: `fontWeight: 'bold'`
- Lines 864, 1540, 1708, 2143: `fontFamily: 'monospace'`
- Line 864: Also has `fontWeight: 500`

---

### [x] src/renderer/repo-manager/shared/AgentSessionCard.tsx ✅
**Issue Count:** 4 instances
**Lines:** 461, 781, 938, 1065
**Problems:**
- Lines 461, 1065: `fontFamily: 'monospace'` → Fixed to `theme.fonts.monospace`
- Lines 461, 1065: `fontSize: '12px'` → Fixed to `theme.fontSizes[1]`
- Line 781: `fontFamily: 'monospace'` → Fixed to `theme.fonts.monospace`
- Line 781: `fontSize: '11px'` → Fixed to `theme.fontSizes[0]`
- Line 938: `fontFamily: 'monospace'` → Fixed to `theme.fonts.monospace`
- Line 938: `fontSize: '10px'` → Fixed to `theme.fontSizes[0]`

---

### [x] src/renderer/repo-manager/shared/RepoSourceArchitecturePanelSimple.tsx ✅
**Issue Count:** 9 instances
**Lines:** 188, 189, 199, 298, 309, 352, 367, 379, 387
**Problems:**
- Lines 188: `fontSize: '15px'` → Fixed to `theme.fontSizes[3]`
- Lines 189, 367: `fontWeight: 600` → Fixed to `theme.fontWeights.semibold`
- Lines 199, 298: `fontSize: '13px'` → Fixed to `theme.fontSizes[2]`
- Lines 309, 352: `fontSize: '12px'` → Fixed to `theme.fontSizes[1]`
- Lines 379, 387: `fontSize: '11px'` → Fixed to `theme.fontSizes[0]`

---

### [x] src/renderer/components/agent-overview/SessionDetailCards.tsx ✅
**Issue Count:** 11 fontWeight + 24 fontSize instances = 35 total
**Lines:** Multiple throughout the file
**Problems:**
- **fontWeight (11 instances):**
  - Lines 63, 107, 151: `fontWeight: 'bold'` → Fixed to `theme.fontWeights.bold`
  - Lines 201, 228, 453, 480, 507, 534 (and more): `fontWeight: 600` → Fixed to `theme.fontWeights.semibold`
  - Lines 256, 330: `fontWeight: 500` → Fixed to `theme.fontWeights.medium`
- **fontSize (24 instances):**
  - `fontSize: '12px'` (9 instances) → Fixed to `theme.fontSizes[1]`
  - `fontSize: '13px'` (1 instance) → Fixed to `theme.fontSizes[2]`
  - `fontSize: '14px'` (5 instances) → Fixed to `theme.fontSizes[2]`
  - `fontSize: '18px'` (6 instances) → Fixed to `theme.fontSizes[3]`
  - `fontSize: '20px'` (3 instances) → Fixed to `theme.fontSizes[4]`

---

### [x] src/renderer/repo-manager/RepositoryWorkspace.tsx ✅
**Issue Count:** 3 instances
**Lines:** 2560, 2633, 2641
**Problems:**
- Line 2560: `fontSize: 11` → Fixed to `theme.fontSizes[0]`
- Line 2633: `fontSize: '16px'` → Fixed to `theme.fontSizes[3]`
- Line 2634: `fontWeight: 600` → Fixed to `theme.fontWeights.semibold`
- Line 2641: `fontSize: '14px'` → Fixed to `theme.fontSizes[2]`

---

### [ ] src/renderer/panels/components/RepositoryActionsPanel.tsx
**Issue Count:** 3 instances
**Lines:** 279, 413, 496
**Problems:**
- Line 279: `fontSize: '18px'`
- Lines 413, 496: `fontSize: '12px'`

---

### [x] src/renderer/principal-window/views/FeedView/FeedView.tsx ✅
**Issue Count:** 1 instance (but important)
**Lines:** 258
**Problems:**
- `style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}` → Fixed to `theme.fontSizes[4]` and `theme.fontWeights.semibold`

---

## Low Priority Files (1-3 instances)

### [x] src/renderer/panels/components/GitDiffPanel.tsx ✅
**Lines:** 453, 458
**Problems:**
- Line 453: `fontSize: '11px'` → Fixed to `theme.fontSizes[0]`
- Line 458: `fontFamily: 'monospace'` → Fixed to `theme.fonts.monospace`

### [ ] src/renderer/panels/components/CarouselTerminalPanel.tsx
**Lines:** 1166
**Problems:** `fontFamily: 'monospace'`

---

### [ ] src/renderer/principal-window/components/themes/ColorPickerInput.tsx
**Lines:** 122
**Problems:** `fontFamily: 'monospace'`

---

### [ ] src/renderer/components/KeychainPermissionModal.tsx
**Lines:** 258
**Problems:** `fontFamily: 'monospace'`

---

### [x] src/renderer/components/markdown/ThemedMarkdownSlide.tsx ✅ DELETED
**Lines:** 116, 137, 138, 177
**Resolution:** File was unused and has been deleted. The app uses higher-level components (`ThemedDocumentView`, `ThemedSlidePresentation`) instead.

---

### [x] src/renderer/components/shared/RepositoryNotesPanel.tsx ✅
**Lines:** 108
**Problems:** Inline style string with `font-size: 12px;` → Fixed by removing hardcoded font-size (now inherits from parent)

---

### [ ] src/renderer/utils/componentDetection.ts
**Lines:** 201
**Problems:** `font-size: 10px;` in CSS string

---

### [ ] src/renderer/pages/MultiFileEditorWindow.tsx
**Lines:** 21
**Problems:** `fontFamily: 'var(--font-sans, system-ui, sans-serif)'`
**Note:** Uses CSS vars with fallback - decide if this should use theme

---

### [ ] src/titlebar/RemoteAgentTitlebar.tsx
**Lines:** 33, 40, 54
**Problems:**
- Line 33: `fontSize: '13px'`
- Line 40: `fontWeight: isSelected ? 600 : 500`
- Line 54: `fontSize: '16px'`

---

### [ ] src/main/window/remoteAgentWindowManager.ts
**Lines:** 418
**Problems:** `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`
**Note:** Main process file - may need different approach

---

## Summary Statistics

- **Total Files:** 30+
- **Total Instances:** 100+
- **Completed:** 10 files (1 deleted) ✅
- **High Priority:** 5 files → 2 remaining (mdx-editor.ts, ToolsPanel.tsx) ⚠️ RepositorySettingsModal.tsx is in unused/ directory
- **Medium Priority:** 8 files → 5 remaining
- **Low Priority:** 15 files → 13 remaining

## Refactoring Strategy

1. **Phase 1:** High priority files (ToolsPanel, ExcalidrawPanel, mdx-editor.ts)
2. **Phase 2:** Medium priority files (AuthDetails, AgentSessionCard, etc.)
3. **Phase 3:** Low priority files (individual instances)
4. **Phase 4:** Review and test theme consistency across all components

## Good Examples (Already Using Theme)

These files correctly use theme properties and can serve as reference:
- ✓ src/renderer/principal-window/views/RepositoryView/GitHubProjectsPanel.tsx
  - Uses: `theme.fonts.body`, `theme.fontSizes[0-3]`
- ✓ src/renderer/panels/components/GitSyncDiagnosticPanel.tsx
  - Uses: `theme.fontSizes[0-3]`, `theme.fonts.monospace`, `theme.fonts.body`
- ✓ src/renderer/panels/components/HelpModal.tsx
  - Uses: `theme.fontSizes[0-4]`, `theme.fonts.body`, `theme.fontWeights.semibold`, `theme.fontWeights.medium`

## Notes

- Files in `src/renderer/unused/` directory may not need updating if scheduled for deletion
- Main process files (src/main/) may need different approach than renderer files
- Consider creating a linting rule to prevent future hardcoded font properties
