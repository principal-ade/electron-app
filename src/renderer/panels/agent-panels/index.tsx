import { SkillsBrowsePanel } from './SkillsBrowsePanel';
import { GlobalSkillsPanel, type GlobalSkillsPanelProps } from './GlobalSkillsPanel';
import { SkillDetailPanel, type SkillDetailPanelProps } from './SkillDetailPanel';
import { AgentDetailPanel } from './AgentDetailPanel';
import { AgenticResourcesPanel } from './AgenticResourcesPanel';
import type { PanelDefinition, PanelContextValue } from '@principal-ade/panel-framework-core';
import type { Skill } from './skills/hooks/useSkillsData';

// Export component props types for external use
export type { SkillDetailPanelProps, GlobalSkillsPanelProps, Skill };

// Export standalone components for direct use
export { SkillsBrowsePanel, GlobalSkillsPanel, AgenticResourcesPanel };

/**
 * Export array of panel definitions.
 * This is the required export for panel extensions.
 */
export const panels: Array<PanelDefinition> = [
  {
    metadata: {
      id: 'industry-theme.skills-browse',
      name: 'Browse Skills',
      icon: '🔍',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Browse Agent Skills from GitHub repositories',
      slices: ['fileTree'], // Only needs fileTree, not globalSkills
    },
    component: SkillsBrowsePanel as unknown as PanelDefinition['component'],

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Skills Browse Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Skills Browse Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'industry-theme.global-skills',
      name: 'Global Skills',
      icon: '🌐',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Display only global Agent Skills (no project skills)',
      slices: ['fileTree', 'globalSkills'], // Depends on fileTree and globalSkills
    },
    component: GlobalSkillsPanel as unknown as PanelDefinition['component'],

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Global Skills Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Global Skills Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'industry-theme.skill-detail',
      name: 'Skill Detail',
      icon: '📋',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Display detailed information about a selected Agent Skill',
      slices: ['fileTree', 'globalSkills'], // Data slices this panel depends on
    },
    component: SkillDetailPanel as unknown as PanelDefinition['component'],

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Skill Detail Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Skill Detail Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'industry-theme.agent-detail',
      name: 'Agent Detail',
      icon: '📄',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Display detailed information about a selected agent or subagent',
      slices: ['fileTree', 'globalAgents', 'globalSubagents'], // Data slices this panel depends on
    },
    component: AgentDetailPanel as unknown as PanelDefinition['component'],

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Agent Detail Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Agent Detail Panel unmounting');
    },
  },
  {
    metadata: {
      id: 'industry-theme.agentic-resources',
      name: 'Agentic Resources',
      icon: '🔧',
      version: '0.1.0',
      author: 'Principal ADE',
      description: 'Unified panel for both Agents and Skills with mode toggle',
      slices: ['fileTree', 'globalAgents', 'globalSubagents', 'globalSkills'], // Data slices this panel depends on
    },
    component: AgenticResourcesPanel as unknown as PanelDefinition['component'],

    // Optional: Called when this specific panel is mounted
    onMount: async (context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log(
        'Agentic Resources Panel mounted',
        context.currentScope.repository?.path
      );
    },

    // Optional: Called when this specific panel is unmounted
    onUnmount: async (_context: PanelContextValue) => {
      // eslint-disable-next-line no-console
      console.log('Agentic Resources Panel unmounting');
    },
  },
];

/**
 * Optional: Called once when the entire package is loaded.
 * Use this for package-level initialization.
 */
export const onPackageLoad = async () => {
  // eslint-disable-next-line no-console
  console.log('Panel package loaded - Agent Panels Extension');
};

/**
 * Optional: Called once when the package is unloaded.
 * Use this for package-level cleanup.
 */
export const onPackageUnload = async () => {
  // eslint-disable-next-line no-console
  console.log('Panel package unloading - Agent Panels Extension');
};

