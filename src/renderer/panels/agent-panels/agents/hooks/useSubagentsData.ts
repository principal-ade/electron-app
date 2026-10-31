import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';
import type { AgentsPanelContext } from '../../types';

export type SubagentSource =
  | 'project-claude'    // ./.claude/agents/
  | 'global-claude';    // ~/.claude/agents/ (from globalSubagents slice)

export interface SubagentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  disallowedTools?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  permissionMode?: 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions' | 'plan';
  skills?: string;
  hooks?: unknown;
}

export interface Subagent {
  id: string;
  name: string;
  path: string;
  content: string; // Full markdown content
  prompt: string;  // The markdown body (after frontmatter)
  frontmatter: SubagentFrontmatter;
  source: SubagentSource;
  priority: 1 | 2; // 1=project-claude, 2=global-claude
}

// Stable empty array to prevent unnecessary re-renders
const EMPTY_SUBAGENTS_ARRAY: Subagent[] = [];

/**
 * Global subagents data provided by the host application
 */
export interface GlobalSubagentsSlice {
  subagents: Subagent[];
}

interface UseSubagentsDataParams {
  context: PanelContextValue<AgentsPanelContext>;
}

interface UseSubagentsDataReturn {
  subagents: Subagent[];
  isLoading: boolean;
  error: string | null;
  refreshSubagents: () => Promise<void>;
}

/**
 * Helper function to determine subagent source and priority from path
 */
const determineSubagentSource = (
  path: string
): { source: SubagentSource; priority: 1 | 2 } => {
  if (path.includes('.claude/agents/')) {
    return { source: 'project-claude', priority: 1 };
  }
  return { source: 'global-claude', priority: 2 };
};

/**
 * Helper function to find subagent files from the FileTree
 * Looks for .md files in .claude/agents/ directory
 */
const findSubagentFiles = (fileTree: FileTree): string[] => {
  // Filter allFiles for .md files in .claude/agents/ directory
  const subagentFiles = fileTree.allFiles.filter(file => {
    const path = file.relativePath;
    const isMarkdown = file.name.endsWith('.md');
    const isInAgentsDir = path.startsWith('.claude/agents/');

    return isMarkdown && isInAgentsDir;
  });

  // Return their relative paths
  return subagentFiles.map(file => file.relativePath);
};

/**
 * Helper function to parse YAML frontmatter from markdown
 */
const parseFrontmatter = (content: string): { frontmatter: SubagentFrontmatter; body: string } => {
  // Check if content starts with frontmatter delimiter
  if (!content.trim().startsWith('---')) {
    throw new Error('No frontmatter found - subagent must have YAML frontmatter');
  }

  const lines = content.split('\n');
  let frontmatterEnd = -1;

  // Find the closing --- (skip the first one at index 0)
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      frontmatterEnd = i;
      break;
    }
  }

  if (frontmatterEnd === -1) {
    throw new Error('Malformed frontmatter - missing closing ---');
  }

  // Extract frontmatter lines (between the two ---)
  const frontmatterLines = lines.slice(1, frontmatterEnd);
  const body = lines.slice(frontmatterEnd + 1).join('\n').trim();

  // Parse YAML frontmatter (simple key: value parser)
  const frontmatter: Partial<SubagentFrontmatter> = {};

  for (const line of frontmatterLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.substring(0, colonIndex).trim();
    const value = trimmedLine.substring(colonIndex + 1).trim();

    // Remove quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, '');

    frontmatter[key as keyof SubagentFrontmatter] = cleanValue as never;
  }

  // Validate required fields
  if (!frontmatter.name || !frontmatter.description) {
    throw new Error('Subagent frontmatter must have "name" and "description" fields');
  }

  return {
    frontmatter: frontmatter as SubagentFrontmatter,
    body,
  };
};

/**
 * Helper function to parse subagent markdown content
 */
const parseSubagentContent = (content: string, path: string): Subagent => {
  try {
    const { frontmatter, body } = parseFrontmatter(content);

    // Determine source and priority
    const { source, priority } = determineSubagentSource(path);

    return {
      id: path,
      name: frontmatter.name,
      path,
      content,
      prompt: body,
      frontmatter,
      source,
      priority,
    };
  } catch (err) {
    console.error(`Failed to parse subagent at ${path}:`, err);
    throw err;
  }
};

/**
 * Hook to discover and read subagent files from .claude/agents/ directory
 */
export const useSubagentsData = ({
  context,
}: UseSubagentsDataParams): UseSubagentsDataReturn => {
  const [subagents, setSubagents] = useState<Subagent[]>(EMPTY_SUBAGENTS_ARRAY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract stable references from context
  const fileTreeSlice = context.fileTree;
  const fileTree = fileTreeSlice?.data;
  const fileTreeSha = fileTree?.sha;
  const globalSubagentsSlice = context.globalSubagents;

  // Memoize globalSubagents to prevent infinite re-renders
  const globalSubagents = useMemo(
    () => globalSubagentsSlice?.data?.subagents ?? EMPTY_SUBAGENTS_ARRAY,
    [globalSubagentsSlice?.data?.subagents]
  );
  const globalSubagentsCount = globalSubagents.length; // Use count as stable primitive

  const repoPath = context.currentScope.repository?.path;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileSystem = (context as any).adapters?.fileSystem;

  // Track the last loaded SHA to prevent redundant loads
  const lastLoadedSha = useRef<string | undefined>(undefined);
  const lastGlobalSubagentsCount = useRef<number>(0);

  const loadSubagents = useCallback(async () => {
    // Skip if we've already loaded this exact data
    if (fileTreeSha === lastLoadedSha.current && globalSubagentsCount === lastGlobalSubagentsCount.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let localSubagents: Subagent[] = [];

      if (fileTree && fileSystem?.readFile && repoPath) {
        // Find all subagent files in project
        const subagentPaths = findSubagentFiles(fileTree);

        // Read content for each local subagent
        const subagentPromises = subagentPaths.map(async (subagentPath) => {
          try {
            const fullPath = `${repoPath}/${subagentPath}`;
            const content = await fileSystem.readFile(fullPath);
            return parseSubagentContent(content as string, subagentPath);
          } catch (err) {
            console.error(`Failed to read subagent at ${subagentPath}:`, err);
            return null;
          }
        });

        localSubagents = (await Promise.all(subagentPromises)).filter(
          (subagent): subagent is Subagent => subagent !== null
        );
      }

      // Merge local and global subagents
      const allSubagents = [...localSubagents, ...globalSubagents];

      setSubagents(allSubagents);

      // Update tracking refs
      lastLoadedSha.current = fileTreeSha;
      lastGlobalSubagentsCount.current = globalSubagentsCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subagents';
      setError(errorMessage);
      console.error('Error loading subagents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fileTree, fileTreeSha, globalSubagents, globalSubagentsCount, repoPath, fileSystem]);

  const refreshSubagents = useCallback(async () => {
    // Force reload by clearing the tracking refs
    lastLoadedSha.current = undefined;
    lastGlobalSubagentsCount.current = -1;
    await loadSubagents();
  }, [loadSubagents]);

  useEffect(() => {
    loadSubagents();
  }, [loadSubagents]);

  return {
    subagents,
    isLoading,
    error,
    refreshSubagents,
  };
};
