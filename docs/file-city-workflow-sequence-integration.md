# File City ⇄ Storyboard List: Workflow Sequence Diagram Integration

## Goal

Let a user click a workflow in the **StoryboardListPanel** and have the
**File City panel** render that workflow as a sequence diagram (using
`WorkflowSequenceDiagram` from `@principal-ai/principal-view-react`) in its
existing overlay slot — alongside, or instead of, the runtime/diff sequence
diagrams it already shows.

## Where things stand today

### File City panel (this repo)

- `src/renderer/dev-workspace/file-city-panel/FileCityPanel.tsx:213` renders
  `SequenceDiagramOverlay` whenever `sequencePayload` is set.
- `SequenceDiagramOverlay.tsx:2` wraps `SequenceDiagramRenderer` from
  `@principal-ai/principal-view-react`.
- The payload is `SequenceDiagramPayload` from
  `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts` — events +
  edges, augmented per-event with `sourcePath` and an optional
  `SliceSnippet | DiffSnippet`. Those augmentations are what light up the
  matching building and open the Pierre snippet/diff drawer.
- Source: pushed in by the local Principal MCP Bridge via the two skills
  `file-city-review` and `file-city-sequence`.

### `WorkflowSequenceDiagram` (principal-view-core-library)

- File: `packages/react/src/components/WorkflowSequenceDiagram.tsx`.
- Exported from `@principal-ai/principal-view-react` (already a dep at
  `package.json:225`, currently `^0.15.8`).
- **Not** a separate canvas component — it's a thin wrapper around the same
  `SequenceDiagramRenderer` File City already uses. The "canvas stuff" is
  the OTEL `Canvas` graph type from `principal-view-core`, used to look up
  participant scopes; it is not an HTML `<canvas>`.
- Conversion logic: `convertWorkflowToSequence(scenario, canvas)` at
  `WorkflowSequenceDiagram.tsx:86` derives `SequenceEvent[] / SequenceEdge[]`
  from `scenario.template.events` (object keyed by event name) and the OTEL
  participant/event nodes on the canvas. Sequential edges only (`i → i+1`).

### StoryboardListPanel (industry-themed-principal-view-panels)

- File: `src/panels/StoryboardListPanel.tsx`. Click handler is
  `handleTreeNodeClick` at line 744.
- Workflow click branch is at line 827. It looks up the full
  `WorkflowTemplate` from loaded workflows (line 836: `fullWorkflow`) and
  emits a single `custom` event:

  ```ts
  events.emit({
    type: 'custom',
    source: 'storyboard-list-panel',
    timestamp: Date.now(),
    payload: {
      action: 'openCanvas',
      canvasId, canvas, canvasFileInfo,
      workflowId,
      workflow: fullWorkflow.template,   // WorkflowTemplate, has .scenarios[]
      workflowFileInfo,
      openMode: 'detail',
    },
  });
  ```

- `WorkflowTemplate.scenarios: WorkflowScenario[]` is exactly the input
  `WorkflowSequenceDiagram` wants — no extra fetch needed.

### How it's already wired in this repo

- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:2136-2270`
  already listens for that `custom` / `openCanvas` event from
  `storyboard-list-panel` and converts it into a `canvas-detail` tab.
- So the StoryboardListPanel is **already a workflow source on the bus** —
  the integration question is only about adding a second consumer.

## Two design options

### Option 1 — Listen-in-place (loose coupling, no upstream change)

`FileCityPanel` (or a sibling controller) subscribes to the same `custom`
event. When the payload has `workflow`, pick a scenario (first one, or show a
chooser) and render
`<WorkflowSequenceDiagram scenario={…} canvas={canvas} …/>` in a new overlay
variant.

- **Pro**: zero changes to StoryboardListPanel or the principal-view-panels
  repo. The event is already fanning out.
- **Con**: every workflow click both opens a tab *and* repaints the File City
  overlay. Needs a mode switch (e.g. "Send to File City" toggle, or a
  modifier-key on the click) if that's not the UX we want.

### Option 2 — Explicit channel (recommended)

Add a sibling action — `previewWorkflowInFileCity`, or a `target: 'file-city'`
field on the existing payload — and emit it on a deliberate gesture
(alt-click, context-menu item, or a small button on the workflow row).

- Single upstream call-site to extend: `StoryboardListPanel.tsx:744`,
  workflow branch around line 827. `fullWorkflow` is already in scope.
- File City listens **only** for that targeted action; tab-open flow is
  unchanged.
- **Pro**: intent is explicit; doesn't fight the existing tab UX.
- **Con**: small change in the principal-view-panels repo (and version
  bump + update of the dep here).

Recommendation: **Option 2**. Makes "drive the File City overlay from the
storyboard tree" an explicit gesture rather than a side effect.

## The hard bit (applies to both options)

`WorkflowScenario.template.events` carries event **names** + handlebars
templates, not file paths. So events derived via `convertWorkflowToSequence`
will not have `sourcePath` / `snippet`, which means:

- Buildings in File City **won't light up** for those events.
- The Pierre snippet/diff drawer **won't open**.

If we want those affordances we need an `eventName → { sourcePath, lineRange }`
resolver. Most likely source: the OTEL nodes on the matching `Canvas` —
participant nodes already carry scope/file metadata in some configurations
(`isOtelParticipantNode` and `isOtelEventNode` in
`WorkflowSequenceDiagram.tsx:63-81`). Worst case we ship without highlight
and add the resolver as a follow-up.

## Suggested next steps

1. **Decide UX gesture** — modal/tab or in-place File City overlay? If
   in-place, what triggers it (default click vs. modifier vs. button)?
2. **Pick an option**:
   - If we go with Option 2, draft the payload shape (e.g.
     `action: 'previewWorkflowInFileCity'` with `{ scenario, canvas, workflowFileInfo }`)
     and PR it into `industry-themed-principal-view-panels`.
   - If we go with Option 1, decide how to suppress the redundant tab open
     (consume-and-stop pattern, or have FileCity react only when its panel
     is the focused tab).
3. **Sketch the overlay variant** — extend `SequenceDiagramPayload` (in
   `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`) with a
   discriminated `kind: 'workflow'` variant carrying `{ scenario, canvas }`.
   Either:
   - call `<WorkflowSequenceDiagram />` directly from a new overlay (drops
     `sourcePath`/`snippet`), **or**
   - run `convertWorkflowToSequence` ourselves and merge resolved file
     paths/snippets onto each `SequenceEvent` before handing it to the
     existing `SequenceDiagramOverlay`. This keeps the building-highlight
     and Pierre flow alive.
4. **Resolver for event → file** — if we want the highlight flow, walk
   `canvas.nodes` for OTEL participant/event nodes and build the lookup map
   (the type guards in `WorkflowSequenceDiagram.tsx` are a starting point).

## Key file references

- `src/renderer/dev-workspace/file-city-panel/FileCityPanel.tsx:213`
- `src/renderer/dev-workspace/file-city-panel/SequenceDiagramOverlay.tsx`
- `src/shared/main-process-api-interfaces/FileCitySequenceAPI.ts`
- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:2136`
- `industry-themed-principal-view-panels/src/panels/StoryboardListPanel.tsx:744` (workflow branch line 827)
- `principal-view-core-library/packages/react/src/components/WorkflowSequenceDiagram.tsx` (conversion at line 86)
- `principal-view-core-library/packages/core/src/workflow/types.ts:162` (`WorkflowScenario`)
