import type { LayerRenderStrategy } from '@principal-ai/code-city-react';

export interface ToolVisualization {
  icon: string;
  color: string;
  renderStrategy: LayerRenderStrategy;
  name: string;
}

export const TOOL_VISUALIZATIONS: Record<string, ToolVisualization> = {
  // File operations using ToolName enum values
  Read: {
    icon: '👁',
    color: '#4CAF50',
    renderStrategy: 'border',
    name: 'Read',
  },
  Edit: {
    icon: '✏️',
    color: '#FF9800',
    renderStrategy: 'fill',
    name: 'Edit',
  },
  MultiEdit: {
    icon: '✏️',
    color: '#FF9800',
    renderStrategy: 'fill',
    name: 'Edit',
  },
  Write: {
    icon: '💾',
    color: '#F44336',
    renderStrategy: 'fill',
    name: 'Write',
  },
  Create: {
    icon: '➕',
    color: '#9C27B0',
    renderStrategy: 'fill',
    name: 'Create',
  },

  // Search operations
  Grep: {
    icon: '🔍',
    color: '#2196F3',
    renderStrategy: 'glow',
    name: 'Search',
  },
  Glob: {
    icon: '📁',
    color: '#2196F3',
    renderStrategy: 'glow',
    name: 'Glob',
  },
  LS: {
    icon: '📂',
    color: '#2196F3',
    renderStrategy: 'glow',
    name: 'List',
  },

  // Other operations
  Bash: {
    icon: '⚡',
    color: '#00BCD4',
    renderStrategy: 'pattern',
    name: 'Bash',
  },

  // Legacy mappings for backward compatibility
  read_file: {
    icon: '👁',
    color: '#4CAF50',
    renderStrategy: 'border',
    name: 'Read',
  },
  str_replace_editor: {
    icon: '✏️',
    color: '#FF9800',
    renderStrategy: 'fill',
    name: 'Edit',
  },
  str_replace_editor_advanced: {
    icon: '✏️',
    color: '#FF9800',
    renderStrategy: 'fill',
    name: 'Edit',
  },
  str_replace_based_edit_tool: {
    icon: '✏️',
    color: '#FF9800',
    renderStrategy: 'fill',
    name: 'Edit',
  },
  write_file: {
    icon: '💾',
    color: '#F44336',
    renderStrategy: 'fill',
    name: 'Write',
  },
  create_file: {
    icon: '➕',
    color: '#9C27B0',
    renderStrategy: 'fill',
    name: 'Create',
  },
  grep: {
    icon: '🔍',
    color: '#2196F3',
    renderStrategy: 'glow',
    name: 'Search',
  },
  bash: {
    icon: '⚡',
    color: '#00BCD4',
    renderStrategy: 'pattern',
    name: 'Bash',
  },

  default: {
    icon: '📄',
    color: '#607D8B',
    renderStrategy: 'border',
    name: 'Other',
  },
};

export function getToolVisualization(toolName: string): ToolVisualization {
  return TOOL_VISUALIZATIONS[toolName] || TOOL_VISUALIZATIONS.default;
}
