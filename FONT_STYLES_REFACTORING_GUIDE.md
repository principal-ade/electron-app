# Font Styles Refactoring Guide

## Overview
This guide provides concrete examples for refactoring hardcoded font styles in the panel components to use theme variables instead.

---

## Common Refactoring Patterns

### Pattern 1: Simple fontSize Replacement

**Before (TerminalDebugModal.tsx, line 182):**
```typescript
style={{
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: theme.colors.text,
}}
```

**After (with extended theme):**
```typescript
style={{
  margin: 0,
  fontSize: theme.fontSizes.xl2,  // New: '18px'
  fontWeight: theme.fontWeights.bold,  // New: 600
  color: theme.colors.text,
}}
```

---

### Pattern 2: Multiple Font Properties (Typography)

**Before (AgentEventsPanel.tsx, line 282):**
```typescript
<span style={{ fontWeight: 600, fontSize: '14px' }}>
  Agent Events
</span>
```

**After (with typography helpers):**
```typescript
<span style={theme.typography.header}>
  Agent Events
</span>

// Where theme.typography.header = {
//   fontSize: theme.fontSizes.md,
//   fontWeight: theme.fontWeights.bold,
//   lineHeight: 1.2,
// }
```

---

### Pattern 3: Monospace Font for Code

**Before (GitCommitHistoryPanel.tsx, line 246):**
```typescript
<span style={{
  fontFamily: theme.fonts.monospace,
  fontSize: '11px',
}}>
  {commit.hash.substring(0, 8)}
</span>
```

**After:**
```typescript
<span style={theme.typography.code}>
  {commit.hash.substring(0, 8)}
</span>

// Where theme.typography.code = {
//   fontFamily: theme.fonts.monospace,
//   fontSize: theme.fontSizes.sm,
//   fontWeight: 500,
// }
```

---

## Proposed Theme Extensions

### 1. Extended fontSizes

```typescript
const theme = {
  fontSizes: {
    xs: '9px',      // '9px' - smallest
    sm: '10px',     // '10px' - badges, small text
    base: '12px',   // '12px' - body text (current default)
    md: '14px',     // '14px' - headers, primary text
    lg: '16px',     // '16px' - large headers
    xl: '18px',     // '18px' - modal titles
    xl2: '20px',    // '20px' - large titles
    // Keep existing indexes for backward compatibility
    0: '12px',
    1: '14px',
    2: '16px',
  }
}
```

### 2. Font Weights

```typescript
const theme = {
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 600,      // alias
    extrabold: 700,
  }
}
```

### 3. Typography System

```typescript
const theme = {
  typography: {
    // Headers
    h1: {
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.bold,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.bold,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: theme.fontSizes.md,
      fontWeight: theme.fontWeights.bold,
      lineHeight: 1.4,
    },
    // Body text
    body: {
      fontSize: theme.fontSizes.base,
      fontWeight: theme.fontWeights.normal,
      lineHeight: 1.5,
    },
    // Secondary text
    subtitle: {
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.normal,
      lineHeight: 1.4,
    },
    // Code/monospace
    code: {
      fontSize: theme.fontSizes.sm,
      fontFamily: theme.fonts.monospace,
      fontWeight: theme.fontWeights.medium,
      lineHeight: 1.5,
    },
    // Captions
    caption: {
      fontSize: theme.fontSizes.xs,
      fontWeight: theme.fontWeights.normal,
      lineHeight: 1.4,
      color: theme.colors.textSecondary,
    },
    // Labels/badges
    label: {
      fontSize: theme.fontSizes.xs,
      fontWeight: theme.fontWeights.semibold,
      lineHeight: 1.2,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  }
}
```

---

## Panel-by-Panel Refactoring Guide

### Priority 1: TerminalDebugModal.tsx (33 instances)

**Key Areas to Update:**

1. **Modal Headers (Lines 182-183, 276-277, 346-347, 547-548)**
   - Change: `fontSize: '18px'` or `'14px'` → Use `theme.fontSizes.lg` or `theme.fontSizes.md`
   - Change: `fontWeight: 600` → Use `theme.fontWeights.bold`
   - Better: Use `style={theme.typography.h2}` or `theme.typography.h3`

2. **Body Text (Lines 285, 356, 364, 375, 405, 557)**
   - Change: `fontSize: '12px'` → `theme.fontSizes.base`
   - Affected: Session info, error messages, list items

3. **Small Labels (Lines 433-465)**
   - Multiple badge elements with `fontSize: '10px'` and `fontWeight: 600`
   - Create badge style in typography:
     ```typescript
     badge: {
       fontSize: theme.fontSizes.xs,
       fontWeight: theme.fontWeights.bold,
       padding: '2px 6px',
       borderRadius: '3px',
     }
     ```

4. **Monospace Text (Lines 294, 319, 418, 565)**
   - Change: `fontFamily: 'monospace'` → `theme.fonts.monospace`
   - Use typography helper: `style={theme.typography.code}`

**Estimated Impact:** -19 fontSize, -4 fontFamily, -10 fontWeight instances

---

### Priority 2: AgentEventsPanel.tsx (32 instances)

**Key Areas to Update:**

1. **Panel Header (Line 282)**
   - `fontWeight: 600, fontSize: '14px'` → `style={theme.typography.h3}`

2. **Event Type Labels (Lines 565-566)**
   - Multiple event type tags with `fontSize: '11px'` and `fontWeight: 600`
   - Consider new tag style in typography

3. **File Paths (Lines 670, 727, 759)**
   - All instances of `fontFamily: 'monospace', fontSize: '11px'`
   - Replace with: `style={theme.typography.code}`

4. **Metadata Text (Lines 287, 307, 364, 390, 504)**
   - Multiple `fontSize: '12px'` instances
   - Replace with: `fontSize: theme.fontSizes.base`

**Estimated Impact:** -20 fontSize, -3 fontFamily, -9 fontWeight instances

---

### Priority 3: QualityHexagonPanel.tsx (14 instances)

**Key Areas:**
- Lines with `fontWeight: 600` values (7 instances) → Use `theme.fontWeights.bold`
- Lines with hardcoded fontFamily (4 instances) → Use `theme.fonts.monospace`
- Font sizes (3 instances) → Use extended theme.fontSizes

---

### Priority 4: GitCommitHistoryPanel.tsx (13 instances)

**Key Areas:**
- Button text (line 145): `fontSize: '12px'` → `theme.fontSizes.base`
- Metadata text (lines 243, 247, 252): Multiple small font sizes → Use consistent theme sizes
- Hash display (line 246): `fontFamily: theme.fonts.monospace` - Already good, but verify consistency

**Note:** This panel already uses `theme.fonts.monospace` in some places - good consistency to maintain.

---

### Priority 5: GitIssuesPanel & GitPullRequestsPanel (22 instances total)

**Key Areas:**
- Modal headers with hardcoded sizes
- Preview panels with `fontSize: '11px'`, `'12px'` values
- Badge styles with `fontWeight: 600`

Both panels follow similar patterns - batch refactor together.

---

## Implementation Checklist

### Step 1: Extend Theme Definition
- [ ] Add `fontSizes` with named keys (xs, sm, base, md, lg, xl, xl2)
- [ ] Add `fontWeights` with semantic names (light, normal, medium, bold, extrabold)
- [ ] Add `typography` object with semantic styles
- [ ] Verify backward compatibility with existing `theme.fontSizes[0]`, `[1]`, `[2]`

### Step 2: Critical Panels (65 instances)
- [ ] TerminalDebugModal.tsx - Replace all hardcoded styles
- [ ] AgentEventsPanel.tsx - Replace all hardcoded styles

### Step 3: High Priority Panels (49 instances)
- [ ] QualityHexagonPanel.tsx
- [ ] GitCommitHistoryPanel.tsx
- [ ] GitIssuesPanel.tsx
- [ ] GitPullRequestsPanel.tsx

### Step 4: Medium Priority (19 instances)
- [ ] ToolsPanel.tsx
- [ ] GitStatusPanel.tsx

### Step 5: Low Priority (2 instances)
- [ ] FileTreePanelContent.tsx (already minimal hardcoding)

### Step 6: Validation
- [ ] Visual QA across all panels
- [ ] Test with light and dark themes
- [ ] Test responsive layouts
- [ ] Check accessibility (contrast ratios)

---

## Testing Strategy

### Visual Testing
1. Open each panel in both light and dark themes
2. Verify font sizes look appropriate on different screen resolutions
3. Check that headers, body text, and small text are clearly distinguishable

### Automated Testing
```typescript
// Test that hardcoded fontSize values are gone
describe('FontStyles', () => {
  it('should not have hardcoded fontSize values', () => {
    // Use regex to check source files
    const hasHardcodedFontSize = sourceCode.match(/fontSize\s*:\s*['"][^'"]+px['"]/)
    expect(hasHardcodedFontSize).toBeNull()
  })
})
```

---

## Migration Order Recommendation

1. **Week 1:** Extend theme, update TerminalDebugModal (33 instances)
2. **Week 2:** Update AgentEventsPanel (32 instances)
3. **Week 3:** Update QualityHexagonPanel + GitCommit panels (27 instances)
4. **Week 4:** Update Issues/PRs panels (22 instances)
5. **Week 5:** Update ToolsPanel + GitStatusPanel (19 instances)
6. **Week 6:** QA, testing, final validation

---

## Reference: Current Hardcoded Values Summary

| Value | Count | Panels | Recommendation |
|-------|-------|--------|-----------------|
| '9px' | 6 | Various | theme.fontSizes.xs |
| '10px' | 12 | Various | theme.fontSizes.sm |
| '11px' | 15 | Various | theme.fontSizes.sm or base |
| '12px' | 50+ | Most | theme.fontSizes.base |
| '14px' | 15+ | Headers | theme.fontSizes.md |
| '16px' | 6+ | Large headers | theme.fontSizes.lg |
| '18px' | 3 | Modal titles | theme.fontSizes.xl |
| 'monospace' | 15+ | Code | theme.fonts.monospace |
| 600 | 40+ | Bold text | theme.fontWeights.bold |
| 500 | 7 | Medium | theme.fontWeights.medium |
| 700 | 3 | Extra bold | theme.fontWeights.extrabold |

