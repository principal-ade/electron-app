# Detached Tab Windows

Standalone windows that host one workspace tab moved out of the principal
window. The first slice supports the two identity-reloadable surfaces — local
**topics** and **subsystem models** — and deliberately excludes terminals,
editors, drawings, browsers, and HTTP requests, which carry live state.

## Transfer protocol

The descriptor never travels in a URL. Main owns every transfer:

1. The source calls `WindowService.openDetachedTab(descriptor)`. The bottom-bar
   **move to new window** action, the topic header pop-out button, and drag-out
   all use this same path.
2. Main mints an opaque token, stores the descriptor in its `transfers` map, and
   creates `detached-tab.html#transfer/<token>`. Windows are keyed by
   `detached-tab:<sourceTabId>`; a second request focuses that window and reports
   `alreadyOpen` (the source tab is kept).
3. The destination renderer claims the token (`DETACHED_TAB_CLAIM`), preflights
   the content, renders it, then accepts (`DETACHED_TAB_ACCEPT`).
4. Only an accept resolves `openDetachedTab` with `transferred: true`, which is
   the source's signal to remove its tab. Rejection, load failure, timeout (20s),
   window close, or cancellation keep the source tab.

All claim/accept/reject handlers validate the IPC sender's window id against the
transfer record. Accepted detach records stay in main until the destination
window closes, so a renderer reload can re-claim the tab it already owns.

### Drag-out

The tab library has no external-drop callback, so `useDragOutDetach` observes
the native drag lifecycle on the tab strip (`data-tab-id`): it records a
detachable tab on `dragstart`, treats a `dragleave` with no related target as
leaving the window, and starts a transfer on `dragend` only when the drag left
the window (with clearly out-of-bounds coordinates as a fallback). Reorders and
cancelled drags end inside and are left to the library.

### Return to main

`RETURN_DETACHED_TAB` runs the same handshake in reverse. Main creates a return
transfer, then sends `DETACHED_TAB_INCOMING` (token only) to the principal
window _repeatedly_ until it claims, so a freshly recreated principal window
cannot miss the notification while mounting. The main window opens the tab in
the shared workspace bucket, then accepts; only then does main close the
detached window. `PortalIntentBridge` hosts the listener because it is mounted
at the app root even before a workspace surface exists.

## Files

| Concern                 | Location                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Descriptor + validation | `src/shared/detachedTab.ts`                                                                                       |
| Main protocol           | `src/main/window/detachedTabHandlers.ts`                                                                          |
| Narrow preload          | `src/window/preload-detached-tab.ts`                                                                              |
| IPC channels            | `src/shared/ipc-events/WindowEvents.ts`                                                                           |
| Preload API             | `src/shared/main-process-api-interfaces/WindowAPI.ts`, `src/window/main-process-api-implementations/windowApi.ts` |
| Renderer service        | `src/renderer/main-process-api/WindowService.ts`                                                                  |
| Detached window app     | `src/renderer/detached-tab-window/`                                                                               |
| Source actions          | `src/renderer/move-tab/DetachTabButton.tsx` (+ bottom bar in `WorkspaceShell`, topic header button)               |
| Drag-out detection      | `src/renderer/move-tab/useDragOutDetach.ts`                                                                       |
| Return adopter          | `src/renderer/move-tab/useDetachedTabAdopter.ts`                                                                  |
| Renderer entry          | `detached-tab.html` in the three multi-entry webpack configs                                                      |

## Adding another detachable kind

Only do this when the tab can be reconstructed from a serializable identity, or
when you also add a state-transfer path for its live state.

1. Add the kind + required identity to `DetachableTabDescriptor` and
   `isDetachableTabDescriptor`.
2. Map it in `toDetachableTabDescriptor`.
3. Render it in `DetachedTabWindow` (and decide what "ready" means before
   accepting).
4. Keep terminal-like tabs out until session ownership/handoff exists.

## Current lifecycle decisions

- Closing a detached window without **move back** discards that window's tab.
  Topics/models are reloadable from their left panels; auto-return-on-close is
  still open.
- A detached window hosts one tab. A detached topic's model rail navigates that
  window to the model; project links copy the purl.
- Drag-out is implemented from the tab strip (native drag lifecycle); reorders
  and cancelled drags stay inside and are left to the library.
- Multi-tab detached windows and restart restoration are not implemented.
