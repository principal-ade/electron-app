# Unused Components

This folder contains components that are no longer used in the application but are kept for design inspiration and potential future reference.

## Components

### RepositoryCard.tsx

- Original repository card component from ProjectsView
- Contains good UI patterns for displaying repository information
- Includes drag-and-drop functionality, git status indicators, and action buttons
- Kept as design reference for future repository display components

### RepositorySettingsModal.tsx

- Comprehensive repository settings modal
- Contains patterns for:
  - Avatar customization
  - Tag management
  - Repository metadata editing
  - Local clone management
- Kept as reference for future settings/configuration modals

### TerminalPanelV2.tsx

- Terminal panel component using XTerminalPanel for UI
- Replaced by TerminalPanelPackaged which uses @principal-ade/industry-themed-terminal
- Contains useful patterns for:
  - Terminal recording integration
  - Dev sidecar smart navigation
  - Session refresh on reconnect
  - Ownership management with debouncing
  - Terminal exit message handling
- Kept as reference for terminal integration patterns
- See: docs/TERMINAL_PANEL_V2_DEPRECATION_PLAN.md

### xterminal/ (folder)

- Pure UI component for rendering xterm.js terminals
- Extracted from original TerminalPanel for better testability
- Replaced by @principal-ade/industry-themed-terminal package
- Contains:
  - XTerminalPanel.tsx - Main terminal UI component
  - types.ts - TypeScript type definitions
  - README.md - Component documentation
  - XTerminalPanel.css - Terminal styling
- Kept as reference for xterm.js integration patterns and UI component structure

## History

- **RepositoryCard.tsx & RepositorySettingsModal.tsx**: Part of the ProjectsView ecosystem which was replaced by AlexandriaRepositoryManager in 2024.
- **TerminalPanelV2.tsx & xterminal/**: Replaced by TerminalPanelPackaged in late 2025 as part of terminal consolidation effort. The new implementation uses @principal-ade/industry-themed-terminal package instead of the custom XTerminalPanel component.
