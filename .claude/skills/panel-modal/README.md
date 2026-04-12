# Panel Modal Skill

A Claude Code skill for implementing event-driven modal overlays for panels in the Electron app harnes

## Quick Start

Invoke this skill when you need to:

* Display a panel as a modal overlay instead of in a fixed layout slot
* Create modal interactions triggered by user actions (clicks, selections)
* Implement panel modals without modifying the panel itself
* Use the harness-level event system for modal management

## Example Usage

This skill helps you implement modals like:

* Task detail modal (click task → show details in modal)
* Skill viewer modal (click skill → show skill info in modal)
* User profile modal (click user → show profile in modal)
* Any panel that should appear as an overlay

## Pattern Overview

The panel modal pattern uses the event bus to:

1. Listen for trigger events (e.g., `task:selected`)
2. Open modal with the selected panel
3. Re-emit event to panel inside modal
4. Close modal when panel emits close event (e.g., `task:deselected`)

## Implementation

See `SKILL.md` for comprehensive step-by-step implementation guide, code templates, and examples.

## Real-World Example

The Task Detail Modal implementation in `DevWorkspacePanelFramework.tsx` demonstrates this pattern:

* Trigger: `task:selected` from Kanban panel
* Modal: TaskDetailPanel rendered in overlay
* Close: `task:deselected` from panel's X button

## Key Benefits

* ✅ No panel modifications needed
* ✅ Centralized modal control at harness level
* ✅ Reusable pattern for any panel
* ✅ Consistent with event-driven architecture
* ✅ Panels work in both layout slots and modals