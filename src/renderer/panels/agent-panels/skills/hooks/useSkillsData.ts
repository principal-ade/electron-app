import { useState, useEffect, useCallback, useRef } from 'react';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';
import type { SkillsPanelContext } from '../../types';
import {
  findSkillFiles,
  parseSkillContent,
} from '../utils/skillsUtils';

export type SkillSource =
  | 'project-universal'  // ./.agent/skills/ (from fileTree)
  | 'global-universal'   // ~/.agent/skills/ (from globalSkills slice)
  | 'project-claude'     // ./.claude/skills/ (from fileTree)
  | 'global-claude'      // ~/.claude/skills/ (from globalSkills slice)
  | 'project-other';     // any other location in project (from fileTree)

export interface SkillMetadata {
  installedFrom?: string;
  skillPath?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  installedAt?: string;
  destination?: string;
  sha?: string;
  files?: string[];
}

export interface SkillInstallation {
  path: string;
  source: SkillSource;
  priority: 1 | 2 | 3 | 4 | 5;
  skillFolderPath: string;
  metadata?: SkillMetadata;
}

export interface FrontmatterValidation {
  isValid: boolean;
  hasStructure: boolean; // Has --- delimiters
  missingFields: string[]; // Array of missing required fields
  errorMessage?: string; // Human-readable error message
}

export interface Skill {
  id: string;
  name: string;
  path: string;
  description?: string;
  content?: string;
  capabilities?: string[];
  // Skill folder structure metadata
  skillFolderPath: string;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  scriptFiles?: string[];
  referenceFiles?: string[];
  assetFiles?: string[];
  // Source and priority metadata (for display purposes only)
  source: SkillSource;
  priority: 1 | 2 | 3 | 4 | 5;  // 1=project-universal, 2=global-universal, 3=project-claude, 4=global-claude, 5=project-other
  // Installation metadata (from .metadata.json)
  metadata?: SkillMetadata;
  // Multiple installation locations (for deduplication)
  installedLocations?: SkillInstallation[];
  // Frontmatter validation
  frontmatterValidation: FrontmatterValidation;
}

// Stable empty array to prevent unnecessary re-renders
const EMPTY_SKILLS_ARRAY: Skill[] = [];

/**
 * Global skills data provided by the host application
 */
export interface GlobalSkillsSlice {
  skills: Skill[];
}

interface UseSkillsDataParams {
  context: PanelContextValue<SkillsPanelContext>;
}

interface UseSkillsDataReturn {
  skills: Skill[];
  isLoading: boolean;
  error: string | null;
  refreshSkills: () => Promise<void>;
}

// Helper functions are now imported from ../utils/skillsUtils

/**
 * Generate a stable deduplication key for a skill
 * Uses GitHub metadata if available, falls back to normalized name
 */
const getDeduplicationKey = (skill: Skill): string => {
  // Prefer GitHub source metadata for unique identification
  if (skill.metadata?.owner && skill.metadata?.repo && skill.metadata?.skillPath) {
    return `github:${skill.metadata.owner}/${skill.metadata.repo}/${skill.metadata.skillPath}`;
  }

  // Fallback to normalized skill name
  const normalizedName = skill.name.toLowerCase().replace(/\s+/g, '-');
  return `name:${normalizedName}`;
};

/**
 * Compare two skills to determine which should be the primary installation
 * Returns true if skill1 should be primary (has higher priority)
 */
const comparePriority = (skill1: Skill, skill2: Skill): boolean => {
  // Lower priority number = higher priority (project-universal = 1 is highest)
  if (skill1.priority !== skill2.priority) {
    return skill1.priority < skill2.priority;
  }

  // Same priority - use installedAt timestamp if available
  const time1 = skill1.metadata?.installedAt ? new Date(skill1.metadata.installedAt).getTime() : 0;
  const time2 = skill2.metadata?.installedAt ? new Date(skill2.metadata.installedAt).getTime() : 0;

  // More recent installation wins
  return time1 > time2;
};

/**
 * Create a SkillInstallation object from a Skill
 */
const skillToInstallation = (skill: Skill): SkillInstallation => ({
  path: skill.path,
  source: skill.source,
  priority: skill.priority,
  skillFolderPath: skill.skillFolderPath,
  metadata: skill.metadata,
});

/**
 * Deduplicate skills based on metadata, keeping track of all installation locations
 * @param skills Array of all skills (local + global)
 * @param isBrowserMode Whether we're in browser mode (skip deduplication if true)
 * @returns Deduplicated skills with installedLocations populated
 */
const deduplicateSkills = (skills: Skill[], isBrowserMode: boolean = false): Skill[] => {
  // Skip deduplication in browser mode (no metadata available in remote repos)
  if (isBrowserMode) {
    return skills;
  }

  if (skills.length === 0) {
    return skills;
  }

  // Group skills by deduplication key
  const skillGroups = new Map<string, Skill[]>();

  for (const skill of skills) {
    const key = getDeduplicationKey(skill);
    const group = skillGroups.get(key) || [];
    group.push(skill);
    skillGroups.set(key, group);
  }

  // For each group, select primary and track all installations
  const deduplicatedSkills: Skill[] = [];

  for (const group of skillGroups.values()) {
    if (group.length === 1) {
      // Only one installation, no deduplication needed
      // Still set installedLocations for consistency
      deduplicatedSkills.push({
        ...group[0],
        installedLocations: [skillToInstallation(group[0])],
      });
      continue;
    }

    // Multiple installations - find primary
    const sortedByPriority = [...group].sort((a, b) =>
      comparePriority(a, b) ? -1 : 1
    );

    const primary = sortedByPriority[0];

    // Create installation records for all locations
    const installations = group.map(skillToInstallation);

    // Sort installations by priority for consistent display
    installations.sort((a, b) => a.priority - b.priority);

    // Create deduplicated skill with all installation info
    deduplicatedSkills.push({
      ...primary,
      installedLocations: installations,
    });
  }

  return deduplicatedSkills;
};

/**
 * Hook to discover and read SKILL.md files from the file tree
 */
export const useSkillsData = ({
  context,
}: UseSkillsDataParams): UseSkillsDataReturn => {
  const [skills, setSkills] = useState<Skill[]>(EMPTY_SKILLS_ARRAY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract stable references from context to avoid unnecessary re-renders
  const fileTreeSlice = context.fileTree;
  const fileTree = fileTreeSlice?.data;
  const fileTreeSha = fileTree?.sha; // Use SHA as stable identity
  const globalSkillsSlice = context.globalSkills;
  const globalSkills = globalSkillsSlice?.data?.skills ?? EMPTY_SKILLS_ARRAY;
  const globalSkillsCount = globalSkills.length; // Use count as stable primitive
  const repoPath = context.currentScope.repository?.path;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileSystem = (context as any).adapters?.fileSystem;

  // Track the last loaded SHA to prevent redundant loads
  const lastLoadedSha = useRef<string | undefined>(undefined);
  const lastGlobalSkillsCount = useRef<number>(0);

  const loadSkills = useCallback(async () => {
    // Skip if we've already loaded this exact data
    if (fileTreeSha === lastLoadedSha.current && globalSkillsCount === lastGlobalSkillsCount.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let localSkills: Skill[] = [];
      // Detect browser mode: GitHub repos have paths like "owner/repo" instead of absolute paths
      let isBrowserMode = false;

      if (fileTree && fileSystem?.readFile && repoPath) {
        isBrowserMode = !repoPath.startsWith('/');

        // eslint-disable-next-line no-console
        console.log('[useSkillsData] fileTree:', fileTree);
        // eslint-disable-next-line no-console
        console.log('[useSkillsData] typeof fileTree:', typeof fileTree);
        // eslint-disable-next-line no-console
        console.log('[useSkillsData] fileTree keys:', Object.keys(fileTree));
        // eslint-disable-next-line no-console
        console.log('[useSkillsData] Browser mode:', isBrowserMode);

        // Find all SKILL.md files in project
        const skillPaths = findSkillFiles(fileTree, isBrowserMode);

        // eslint-disable-next-line no-console
        console.log('[useSkillsData] Found skill paths:', skillPaths);

        // Read content for each local skill
        const skillPromises = skillPaths.map(async (skillPath) => {
          try {
            // In browser mode, use the relative path directly (GitHub adapter expects this)
            // In local mode, prepend the absolute repo path
            const fullPath = isBrowserMode ? skillPath : `${repoPath}/${skillPath}`;
            const content = await fileSystem.readFile(fullPath);
            return parseSkillContent(content as string, skillPath, fileTree, fileSystem, isBrowserMode);
          } catch (err) {
            console.error(`Failed to read skill at ${skillPath}:`, err);
            return null;
          }
        });

        localSkills = (await Promise.all(skillPromises)).filter(
          (skill): skill is Skill => skill !== null
        );
      }

      // eslint-disable-next-line no-console
      console.log('[useSkillsData] Global skills:', globalSkills);

      // Merge local and global skills
      const allSkills = [...localSkills, ...globalSkills];

      // eslint-disable-next-line no-console
      console.log('[useSkillsData] Total skills before deduplication:', allSkills.length);

      // Deduplicate skills based on metadata
      const deduplicatedSkills = deduplicateSkills(allSkills, isBrowserMode);

      // eslint-disable-next-line no-console
      console.log('[useSkillsData] Total skills after deduplication:', deduplicatedSkills.length);

      setSkills(deduplicatedSkills);

      // Update tracking refs
      lastLoadedSha.current = fileTreeSha;
      lastGlobalSkillsCount.current = globalSkillsCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load skills';
      setError(errorMessage);
      console.error('Error loading skills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fileTree, fileTreeSha, globalSkills, globalSkillsCount, repoPath, fileSystem]);

  const refreshSkills = useCallback(async () => {
    // Force reload by clearing the tracking refs
    lastLoadedSha.current = undefined;
    lastGlobalSkillsCount.current = -1;
    await loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  return {
    skills,
    isLoading,
    error,
    refreshSkills,
  };
};
