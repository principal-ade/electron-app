/**
 * Event payload type definitions for DevWorkspace
 *
 * These types define the structure of payloads for various panel events
 * used throughout the DevWorkspace panel framework.
 */

import type { FileInfo } from '@principal-ai/repository-abstraction';
import type { WorkflowTemplate } from '@principal-ai/principal-view-core';
import type { Skill } from '@industry-theme/agent-panels';
import type { RegisteredTrace } from '@principal-ai/principal-view-core';
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
 * Payload when a trace is selected for detail view
 */
export interface TraceSelectedPayload {
  trace?: RegisteredTrace;
  traceId?: string;
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
 * Payload when opening a canvas
 * Can include workflow information for detail view
 */
export interface CanvasOpenPayload {
  action?: string;
  canvasId?: string;
  canvas?: {
    name: string;
    path: string;
  };
  canvasFileInfo?: FileInfo | null;
  workflowId?: string;
  workflow?: WorkflowTemplate | null;
  workflowFileInfo?: FileInfo | null;
  // Trace focus fields - sent by TraceListPanel when opening from matched spans
  traceId?: string;
  spanId?: string;
  scenarioId?: string;
}

/**
 * Payload for dependency graph events
 */
export interface DependencyGraphPayload {
  packages: PackageLayer[];
}

/**
 * Canvas info for multi-canvas view
 */
export interface MultiCanvasInfo {
  id: string;
  canvas: {
    id: string;
    name: string;
    path: string;
  };
  label?: string;
  fileInfo?: FileInfo | null;
}

/**
 * Payload when opening multi-canvas view
 * Emitted by StoryboardListPanel "View All" button
 */
export interface MultiCanvasOpenPayload {
  action: 'openMultiCanvas';
  canvases: MultiCanvasInfo[];
  canvasType: 'otel' | 'regular';
}
