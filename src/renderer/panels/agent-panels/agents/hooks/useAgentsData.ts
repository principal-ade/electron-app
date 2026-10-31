import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';
import type { AgentsPanelContext } from '../../types';

export type AgentSource =
  | 'project-root'      // ./AGENTS.md at repository root
  | 'project-nested'    // ./path/to/AGENTS.md in subdirectories (monorepo)
  | 'global-universal'; // ~/.claude/AGENTS.md (from globalAgents slice)

export interface Agent {
  id: string;
  name: string;
  path: string;
  content: string;
  source: AgentSource;
  priority: 1 | 2 | 3; // 1=project-root, 2=project-nested, 3=global
  // Extracted sections for quick preview
  sections?: {
    setup?: string;
    build?: string;
    test?: string;
    style?: string;
  };
}

// Stable empty array to prevent unnecessary re-renders
const EMPTY_AGENTS_ARRAY: Agent[] = [];

/**
 * Global agents data provided by the host application
 */
export interface GlobalAgentsSlice {
  agents: Agent[];
}

interface UseAgentsDataParams {
  context: PanelContextValue<AgentsPanelContext>;
}

interface UseAgentsDataReturn {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  refreshAgents: () => Promise<void>;
}

/**
 * Helper function to determine agent source and priority from path
 */
const determineAgentSource = (path: string): { source: AgentSource; priority: 1 | 2 | 3 } => {
  // Check if it's at the root (just "AGENTS.md")
  if (path === 'AGENTS.md') {
    return { source: 'project-root', priority: 1 };
  }
  // Otherwise it's nested (monorepo subdirectory)
  return { source: 'project-nested', priority: 2 };
};

/**
 * Helper function to find AGENTS.md files from the FileTree
 */
const findAgentFiles = (fileTree: FileTree): string[] => {
  // Filter allFiles for AGENTS.md files anywhere in the tree
  const agentFiles = fileTree.allFiles.filter(file => {
    const fileName = file.name.toUpperCase();
    return fileName === 'AGENTS.MD';
  });

  // Return their relative paths
  return agentFiles.map(file => file.relativePath);
};

/**
 * Helper function to extract common sections from AGENTS.md content
 */
const extractSections = (content: string): Agent['sections'] => {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');

  let currentSection: string | null = null;
  let currentContent: string[] = [];

  const sectionPatterns = {
    setup: /^#+ (setup|installation|getting started)/i,
    build: /^#+ (build|building|compilation)/i,
    test: /^#+ (test|testing|tests|qa)/i,
    style: /^#+ (style|code style|conventions|guidelines)/i,
  };

  for (const line of lines) {
    // Check if this line starts a new section
    let matchedSection: string | null = null;
    for (const [key, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line)) {
        matchedSection = key;
        break;
      }
    }

    if (matchedSection) {
      // Save previous section if any
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent
          .join('\n')
          .trim()
          .substring(0, 200); // Limit to 200 chars for preview
      }
      // Start new section
      currentSection = matchedSection;
      currentContent = [];
    } else if (currentSection && line.trim()) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent
      .join('\n')
      .trim()
      .substring(0, 200);
  }

  return sections as Agent['sections'];
};

/**
 * Helper function to parse AGENTS.md content
 */
const parseAgentContent = (content: string, path: string): Agent => {
  // Extract name from path
  const pathParts = path.split('/');
  const isRoot = path === 'AGENTS.md';
  const name = isRoot ? 'Project Agents' : pathParts[pathParts.length - 2] || 'Agents';

  // Determine source and priority
  const { source, priority } = determineAgentSource(path);

  // Extract sections for preview
  const sections = extractSections(content);

  return {
    id: path,
    name,
    path,
    content,
    source,
    priority,
    sections,
  };
};

/**
 * Hook to discover and read AGENTS.md files from the file tree
 */
export const useAgentsData = ({
  context,
}: UseAgentsDataParams): UseAgentsDataReturn => {
  const [agents, setAgents] = useState<Agent[]>(EMPTY_AGENTS_ARRAY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract stable references from context
  const fileTreeSlice = context.fileTree;
  const fileTree = fileTreeSlice?.data;
  const fileTreeSha = fileTree?.sha;
  const globalAgentsSlice = context.globalAgents;

  // Memoize globalAgents to prevent infinite re-renders
  const globalAgents = useMemo(
    () => globalAgentsSlice?.data?.agents ?? EMPTY_AGENTS_ARRAY,
    [globalAgentsSlice?.data?.agents]
  );
  const globalAgentsCount = globalAgents.length; // Use count as stable primitive

  const repoPath = context.currentScope.repository?.path;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileSystem = (context as any).adapters?.fileSystem;

  // Track the last loaded SHA to prevent redundant loads
  const lastLoadedSha = useRef<string | undefined>(undefined);
  const lastGlobalAgentsCount = useRef<number>(0);

  const loadAgents = useCallback(async () => {
    // Skip if we've already loaded this exact data
    if (fileTreeSha === lastLoadedSha.current && globalAgentsCount === lastGlobalAgentsCount.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let localAgents: Agent[] = [];

      if (fileTree && fileSystem?.readFile && repoPath) {
        // Find all AGENTS.md files in project
        const agentPaths = findAgentFiles(fileTree);

        // Read content for each local agent
        const agentPromises = agentPaths.map(async (agentPath) => {
          try {
            const fullPath = `${repoPath}/${agentPath}`;
            const content = await fileSystem.readFile(fullPath);
            return parseAgentContent(content as string, agentPath);
          } catch (err) {
            console.error(`Failed to read agent at ${agentPath}:`, err);
            return null;
          }
        });

        localAgents = (await Promise.all(agentPromises)).filter(
          (agent): agent is Agent => agent !== null
        );
      }

      // Merge local and global agents
      const allAgents = [...localAgents, ...globalAgents];

      setAgents(allAgents);

      // Update tracking refs
      lastLoadedSha.current = fileTreeSha;
      lastGlobalAgentsCount.current = globalAgentsCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load agents';
      setError(errorMessage);
      console.error('Error loading agents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fileTree, fileTreeSha, globalAgents, globalAgentsCount, repoPath, fileSystem]);

  const refreshAgents = useCallback(async () => {
    // Force reload by clearing the tracking refs
    lastLoadedSha.current = undefined;
    lastGlobalAgentsCount.current = -1;
    await loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    isLoading,
    error,
    refreshAgents,
  };
};
