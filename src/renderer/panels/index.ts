/**
 * Internal Panels
 *
 * This module exports panel definitions created within the electron-app.
 * These follow the same structure as external panel packages.
 */

// Terminal Sessions Panel
export {
  panels as terminalSessionsPanels,
  terminalSessionsPanelDefinition,
  TerminalSessionsPanel,
} from './terminal-sessions';

// Agent Panels (Skills, AGENTS.md, Subagents)
export {
  panels as agentPanels,
  SkillsBrowsePanel,
  GlobalSkillsPanel,
  AgenticResourcesPanel,
} from './agent-panels';
export type { Skill, SkillDetailPanelProps, GlobalSkillsPanelProps } from './agent-panels';
