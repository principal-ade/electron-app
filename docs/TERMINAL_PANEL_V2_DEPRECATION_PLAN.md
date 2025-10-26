# TerminalPanelV2 Deprecation Plan

## Overview

This document outlines the plan to deprecate `TerminalPanelV2` and consolidate all terminal functionality into `TerminalPanelPackaged`.

**Current State:**
- `TerminalPanelV2` - Business logic layer using `XTerminalPanel` for UI
- `TerminalPanelPackaged` - Themed terminal using `ThemedTerminalWithProvider` from `@principal-ade/industry-themed-terminal`

**Goal:** Migrate all critical features from V2 to Packaged, then delete V2.

---

## Current Usage Analysis

### Active Usage
- **TerminalPanelV2** is used by: `TabbedTerminalPanel` (line 20)
- **Terminal Recording** is actively used by `TabbedTerminalPanel` for debugging (lines 294, 310)
- **Dev Sidecar** is used by both components but with different implementations

### Files to Update
- `src/renderer/panels/components/TabbedTerminalPanel.tsx` - Replace V2 with Packaged
- `src/renderer/panels/TerminalPanelV2.tsx` - Delete after migration
- `src/renderer/panels/components/xterminal/XTerminalPanel.tsx` - May become orphaned

---

## Feature Migration Checklist

### 🔴 CRITICAL - Must Migrate

#### 1. Terminal Data Recording ✅ **REQUIRED**

**Location:** `TerminalPanelV2.tsx:389`

**Current Implementation:**
```typescript
terminalRecorder.recordDataReceived(sessionId, data.data);
```

**Purpose:**
- Records all terminal I/O for debugging
- Captures scroll events alongside data flow
- Used for debugging scroll bar jumping issues

**Evidence of Usage:**
- `TabbedTerminalPanel.tsx:294, 310` - Start/stop recording
- `docs/TERMINAL_SCROLL_RECORDING.md` - Full documentation

**Migration Complexity:** Low (1 line of code)

**Decision Options:**
- [ ] **Option A (RECOMMENDED)**: Add to TerminalPanelPackaged - single line, no performance impact
- [ ] **Option B**: Keep V2 only for recording use cases - creates maintenance burden
- [ ] **Option C**: Make recording opt-in via prop - unnecessary complexity

**Recommendation:** **Option A** - Add one line in the data handler:
```typescript
// In TerminalPanelPackaged data listener (around line 240)
terminalRecorder.recordDataReceived(sessionId, data.data);
terminalRef.current.write(data.data);
```

---

#### 2. Dev Sidecar Integration ⚠️ **DIFFERENT IMPLEMENTATIONS**

**Current State:** Both components have dev sidecar, but different behavior

**V2 Implementation** (`TerminalPanelV2.tsx:452-481`):
```typescript
// Smart navigation - reuses existing sidecar window
const handleLinkClick = async (url: string, isLocalhost: boolean) => {
  if (isLocalhost) {
    try {
      const currentSessionId = devSidecarSessionIdRef.current;
      if (currentSessionId) {
        // Navigate existing window
        await DevSidecarService.navigate(currentSessionId, url);
        await DevSidecarService.focusWindow(currentSessionId);
      } else {
        // Create new window
        const info = await DevSidecarService.createWindow({ devServerUrl: url });
        setDevSidecarSessionId(info.sessionId);
      }
    } catch (err) {
      // Fallback to external
      ShellService.openExternal(url);
    }
  } else {
    ShellService.openExternal(url);
  }
};
```

**Packaged Implementation** (`TerminalPanelPackaged.tsx:352-358`):
```typescript
// Simple - opens all links externally
const handleLinkClick = useCallback((url: string, isLocalhost: boolean) => {
  if (isLocalhost) {
    ShellService.openExternal(url);
  } else {
    ShellService.openExternal(url);
  }
}, []);
```

**Migration Complexity:** Medium

**Decision Options:**
- [ ] **Option A (RECOMMENDED)**: Port V2's smart sidecar logic to Packaged - better UX for dev workflows
- [ ] **Option B**: Keep Packaged's simpler approach - loses important functionality
- [ ] **Option C**: Make sidecar behavior configurable via prop - over-engineering

**Recommendation:** **Option A** - The smart navigation is a key feature:
1. Reuses existing dev sidecar windows
2. Allows navigation within the same window
3. Better workflow for iterative development
4. Fallback to external browser on error

**Required Changes:**
- Add `devSidecarSessionId` state tracking (V2 has this at lines 86-90)
- Add sidecar lifecycle listener (V2 has this at lines 186-197)
- Port smart link handler logic

---

#### 3. Session Refresh on Reconnect ✅ **CRITICAL FOR UX**

**Location:** `TerminalPanelV2.tsx:416-431`

**Current Implementation:**
```typescript
useEffect(() => {
  if (!sessionId || !terminalId) {
    return;
  }

  const refreshSession = async () => {
    try {
      await TerminalService.refresh(sessionId);
    } catch (error) {
      console.error('[TerminalPanelV2] Failed to refresh terminal:', error);
    }
  };

  // Wait for terminal to be fully initialized before refreshing
  setTimeout(refreshSession, 200);
}, [sessionId, terminalId]);
```

**Purpose:**
- Shows terminal buffer contents when re-attaching to existing session
- Without this, re-attached terminals appear blank

**Impact:** Without this feature, re-attachment is broken

**Migration Complexity:** Low (copy effect)

**Decision Options:**
- [ ] **Option A (REQUIRED)**: Add to TerminalPanelPackaged
- [ ] **Option B**: Skip - breaks re-attachment UX

**Recommendation:** **Option A** - This is essential for proper terminal re-attachment

---

### 🟡 IMPORTANT - High Value Features

#### 4. Terminal Exit Message

**Location:** `TerminalPanelV2.tsx:397-405`

**Current Implementation:**
```typescript
const unsubscribeExit = TerminalService.onExit(
  async (exitData: { sessionId: string; code: number }) => {
    if (exitData.sessionId === sessionId && terminalRef.current) {
      terminalRef.current.write(
        `\r\n[Process exited with code ${exitData.code}]\r\n`,
      );
    }
  },
);
```

**Purpose:** Shows user when terminal process exits and exit code

**Migration Complexity:** Low

**Decision:**
- [ ] Add to Packaged - better user feedback
- [ ] Skip - user can infer from terminal state

**Recommendation:** Add to Packaged - improves UX with minimal code

---

#### 5. Debounced Ownership Checks (Performance)

**Location:** `TerminalPanelV2.tsx:104, 329-332`

**Current Implementation:**
```typescript
// 150ms debounce to prevent IPC storm during tab switching
ownershipCheckTimeoutRef.current = setTimeout(() => {
  checkAndClaimOwnership();
}, 150);
```

**Purpose:** Prevents IPC storm when rapidly switching tabs in multi-window scenarios

**Packaged's Approach:** Single check on mount via `hasInitializedRef`

**Migration Complexity:** Low

**Decision:**
- [ ] Add to Packaged - performance optimization for tab switching
- [ ] Skip - Packaged's single-check strategy may be sufficient

**Recommendation:** Test Packaged's current approach first. If IPC storms occur during tab switching, add debouncing.

---

#### 6. Visibility-Based Ownership Release

**Location:** `TerminalPanelV2.tsx:258-263`

**Current Implementation:**
```typescript
// If not visible, release ownership and skip the check
if (!isVisible) {
  TerminalService.releaseOwnership(sessionId);
  return;
}
```

**Purpose:** Releases ownership when terminal becomes invisible (prevents holding ownership unnecessarily)

**Migration Complexity:** Low

**Decision:**
- [ ] Add to Packaged
- [ ] Skip - less critical with single-check approach

**Recommendation:** Skip initially, add if ownership conflicts occur

---

#### 7. Ownership Lost Event Listener

**Location:** `TerminalPanelV2.tsx:352-376`

**Current Implementation:**
```typescript
const unsubscribe = TerminalService.onOwnershipLost(
  (data: { sessionId: string; newOwnerWindowId: number }) => {
    if (data.sessionId === sessionId) {
      console.log(`Lost ownership to window ${data.newOwnerWindowId}`);
      setOwnershipStatus({
        isOwned: true,
        ownedByWindowId: data.newOwnerWindowId,
        canTakeControl: true,
      });
      setShouldRenderTerminal(false);
    }
  },
);
```

**Purpose:** Real-time updates when another window steals ownership

**Migration Complexity:** Low

**Decision:**
- [ ] Add to Packaged - better real-time ownership tracking
- [ ] Skip - rely on initial ownership check only

**Recommendation:** Skip initially, add if users report ownership state issues

---

### 🟢 NICE TO HAVE - Review Only

#### 8. Duplicate Session Prevention

**V2:** Uses `isCreatingSessionRef` (lines 90-91, 211-232)
**Packaged:** Uses `hasInitializedRef` (line 91, 174-178)

**Status:** ✅ Already solved differently in Packaged

**Decision:** No action needed - Packaged has its own approach

---

#### 9. Context-Aware Session Logic

Both implementations have smart session creation logic:
- Initial commands → always new session
- Agent sessions → always new session
- Tab contexts (`:tab-`) → always new session
- Regular → reuse via `getOrCreate`

**Status:** ✅ Both implementations are similar

**Decision:** No action needed - Packaged has adequate logic (lines 131-159)

---

#### 10. AI Session API Signature Difference 🚨 **BLOCKING QUESTION**

**V2 Signature:**
```typescript
AgentSessionService.getSession(directory, agentSessionId)
```

**Packaged Signature:**
```typescript
AgentSessionService.getSession(agentSessionId)
```

**Location:**
- V2: `TerminalPanelV2.tsx:165`
- Packaged: `TerminalPanelPackaged.tsx:267`

**Decision:**
- [ ] Investigate which API signature is correct
- [ ] Update incorrect implementation to match canonical API

**Recommendation:** **MUST RESOLVE BEFORE MIGRATION** - Check `AgentSessionService.ts` to see actual method signature

---

## Migration Plan

### Phase 1: Critical Features (Required for Parity)

**Goal:** Add must-have features to TerminalPanelPackaged

**Tasks:**
1. [ ] Add `terminalRecorder.recordDataReceived()` to data handler
2. [ ] Port smart dev sidecar logic from V2
3. [ ] Add session refresh on reconnect effect
4. [ ] Add terminal exit message handler

**Testing:**
- Recording functionality works
- Dev sidecar navigation works
- Re-attachment shows terminal buffer
- Exit codes display properly

**Estimated Effort:** 2-4 hours

---

### Phase 2: Resolve Blocking Issues

**Tasks:**
1. [ ] Investigate `AgentSessionService.getSession()` API signature
2. [ ] Update whichever component has wrong signature
3. [ ] Verify AI session info displays correctly

**Estimated Effort:** 30 minutes

---

### Phase 3: Replace V2 in TabbedTerminalPanel

**Goal:** Switch TabbedTerminalPanel to use TerminalPanelPackaged

**Tasks:**
1. [ ] Update import: `import TerminalPanelPackaged from '../TerminalPanelPackaged'`
2. [ ] Update type ref: `TerminalPanelPackagedRef` instead of `TerminalPanelV2Ref`
3. [ ] Verify all props are compatible (they should be identical)

**Testing:**
- [ ] Tab creation works
- [ ] Tab switching works
- [ ] Recording works in tabbed panel
- [ ] Session persistence works
- [ ] Multi-window ownership works

**Estimated Effort:** 1 hour

---

### Phase 4: Comprehensive Testing

**Test Scenarios:**
1. **Single Terminal**
   - [ ] Create new terminal
   - [ ] Re-attach to existing terminal
   - [ ] Terminal shows buffer on re-attach
   - [ ] Links open in dev sidecar
   - [ ] Exit codes display

2. **Tabbed Terminals**
   - [ ] Create multiple tabs
   - [ ] Switch between tabs rapidly
   - [ ] Recording captures data correctly
   - [ ] No duplicate sessions created

3. **Multi-Window**
   - [ ] Pop out terminal
   - [ ] Ownership overlay shows correctly
   - [ ] Take control works
   - [ ] Switch to window works

4. **Edge Cases**
   - [ ] Localhost links navigate existing sidecar
   - [ ] External links open in browser
   - [ ] Terminal survives component unmount
   - [ ] Session limit enforcement (20)

**Estimated Effort:** 2-3 hours

---

### Phase 5: Cleanup

**Tasks:**
1. [ ] Delete `src/renderer/panels/TerminalPanelV2.tsx`
2. [ ] Check if `XTerminalPanel` is still used
   - If yes: Keep it
   - If no: Consider deprecating (separate decision)
3. [ ] Update documentation
4. [ ] Remove V2 from any remaining imports

**Estimated Effort:** 1 hour

---

## Implementation Notes

### Terminal Recording Integration

Add to `TerminalPanelPackaged.tsx` around line 240:

```typescript
// Listen for terminal data from backend
useEffect(() => {
  if (!sessionId || !shouldRenderTerminal) return;

  let mounted = true;
  let unsubscribe: (() => void) | undefined;

  const subscribe = async () => {
    unsubscribe = await TerminalService.onData((data) => {
      if (mounted && data.sessionId === sessionId && terminalRef.current) {
        // ADD THIS LINE:
        terminalRecorder.recordDataReceived(sessionId, data.data);

        terminalRef.current.write(data.data);
      }
    });
  };

  subscribe();

  return () => {
    mounted = false;
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [sessionId, shouldRenderTerminal]);
```

### Dev Sidecar Integration

Add state and lifecycle tracking:

```typescript
// Add to component state
const devSidecarSessionIdRef = useRef<string | null>(null);

// Add sidecar lifecycle listener
useEffect(() => {
  if (!agentSessionId) {
    setDevSidecarSessionId(null);
    devSidecarSessionIdRef.current = null;
    return;
  }

  let mounted = true;

  const checkSidecar = async () => {
    try {
      const session = await AgentSessionService.getSession(agentSessionId);
      if (mounted && session?.devSidecarSessionId) {
        setDevSidecarSessionId(session.devSidecarSessionId);
        devSidecarSessionIdRef.current = session.devSidecarSessionId;
      }
    } catch (error) {
      console.error('[TerminalPanelPackaged] Failed to check dev sidecar:', error);
    }
  };

  checkSidecar();

  return () => {
    mounted = false;
  };
}, [agentSessionId]);

// Listen for sidecar window close
useEffect(() => {
  const unsubscribe = DevSidecarService.onWindowClosed((closedSessionId) => {
    if (closedSessionId === devSidecarSessionId) {
      setDevSidecarSessionId(null);
    }
  });
  return () => {
    unsubscribe();
  };
}, [devSidecarSessionId]);
```

Update link handler:

```typescript
const handleLinkClick = useCallback(
  async (url: string, isLocalhost: boolean) => {
    if (isLocalhost) {
      try {
        const currentSessionId = devSidecarSessionIdRef.current;
        if (currentSessionId) {
          await DevSidecarService.navigate(currentSessionId, url);
          await DevSidecarService.focusWindow(currentSessionId);
        } else {
          const info = await DevSidecarService.createWindow({
            devServerUrl: url,
          });
          setDevSidecarSessionId(info.sessionId);
        }
      } catch (err) {
        console.error(
          '[TerminalPanelPackaged] Failed to open link in dev sidecar:',
          url,
          err,
        );
        ShellService.openExternal(url).catch(console.error);
      }
    } else {
      ShellService.openExternal(url).catch((err) => {
        console.error('[TerminalPanelPackaged] Failed to open link:', url, err);
      });
    }
  },
  [devSidecarSessionId],
);
```

---

## Risk Assessment

### Low Risk
- Terminal recording (1 line)
- Session refresh (copy existing effect)
- Exit message (simple listener)

### Medium Risk
- Dev sidecar integration (more code, needs testing)
- TabbedTerminalPanel replacement (integration point)

### High Risk
- None identified

### Mitigation Strategies
1. Feature flag for rollback if needed
2. Keep V2 file until full validation
3. Test in development extensively before production

---

## Success Criteria

✅ Migration is successful when:
1. All TabbedTerminalPanel features work identically
2. Recording captures data and scroll events
3. Dev sidecar navigation works correctly
4. Re-attachment shows terminal buffer
5. No performance regressions
6. No IPC storms during tab switching
7. TerminalPanelV2.tsx is deleted

---

## Timeline Estimate

**Total Effort:** 6-10 hours

- Phase 1: 2-4 hours
- Phase 2: 0.5 hour
- Phase 3: 1 hour
- Phase 4: 2-3 hours
- Phase 5: 1 hour

**Recommended Approach:** Execute in phases with testing between each phase

---

## Questions for Review

1. **Dev Sidecar:** Should all terminals get smart sidecar navigation, or keep it simpler?
2. **Ownership Debouncing:** Is the single-check approach sufficient, or do we need debouncing?
3. **XTerminalPanel Future:** After V2 deletion, should XTerminalPanel be kept or deprecated?
4. **Recording:** Should this be always-on or opt-in via prop?

---

## References

- `src/renderer/panels/TerminalPanelV2.tsx` - Source implementation
- `src/renderer/panels/TerminalPanelPackaged.tsx` - Target implementation
- `src/renderer/panels/components/TabbedTerminalPanel.tsx` - Primary consumer
- `docs/TERMINAL_SCROLL_RECORDING.md` - Recording feature documentation
