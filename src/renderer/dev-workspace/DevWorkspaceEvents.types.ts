/**
 * Event payload type definitions for DevWorkspace
 *
 * These types define the structure of payloads for various panel events
 * used throughout the DevWorkspace panel framework.
 */

import type { Skill } from '@industry-theme/agent-panels';
import type { PackageLayer } from '@industry-theme/repository-composition-panels';

/**
 * Payload when a document is selected to open in right panel
 * Emitted by Alexandria docs panel context menu
 */
export interface DocumentSelectedPayload {
  path: string;
  relativePath: string;
  name: string;
}

/**
 * Payload when a task is selected
 * Contains task metadata and file path to open
 */
export interface TaskSelectedPayload {
  task: {
    filePath?: string;
    title?: string;
  };
  taskId?: string;
}

/**
 * Payload when a skill is selected for detail view
 */
export interface SkillSelectedPayload {
  skill?: Skill;
  skillId?: string;
}

/**
 * Payload when an agent is selected
 * Contains agent metadata to open AGENTS.md file
 */
export interface AgentSelectedPayload {
  data?: {
    id?: string;
    path?: string;
    name?: string;
  };
}

/**
 * Payload when a GitHub issue is selected
 */
export interface IssueSelectedPayload {
  issue: unknown;
}

/**
 * Payload when a file is opened
 * Can include git status for diff view
 */
export interface FileOpenedPayload {
  path: string;
  gitStatus?: string;
}

/**
 * Payload for MDX editor events
 * Supports both filePath and path properties for compatibility
 */
export interface MDXEditorPayload {
  filePath?: string;
  path?: string;
}

/**
 * Payload for dependency graph events
 */
export interface DependencyGraphPayload {
  packages: PackageLayer[];
}
