import { useState, useEffect, useCallback, useRef } from 'react';
import type { PanelContextValue } from '@principal-ade/panel-framework-core';
import type { SkillsPanelContext } from '../../types';
import type { Skill } from './useSkillsData';
import {
  findSkillFiles,
  parseSkillContent,
} from '../utils/skillsUtils';

// Stable empty array to prevent unnecessary re-renders
const EMPTY_SKILLS_ARRAY: Skill[] = [];

interface UseSkillsBrowseDataParams {
  context: PanelContextValue<SkillsPanelContext>;
}

interface UseSkillsBrowseDataReturn {
  skills: Skill[];
  isLoading: boolean;
  error: string | null;
  refreshSkills: () => Promise<void>;
}

/**
 * Hook to discover and read SKILL.md files from GitHub repositories
 * This hook is specifically for browse mode and does NOT include global skills
 */
export const useSkillsBrowseData = ({
  context,
}: UseSkillsBrowseDataParams): UseSkillsBrowseDataReturn => {
  const [skills, setSkills] = useState<Skill[]>(EMPTY_SKILLS_ARRAY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract stable references from context
  const fileTreeSlice = context.fileTree;
  const fileTree = fileTreeSlice?.data;
  const fileTreeSha = fileTree?.sha;
  const repoPath = context.currentScope.repository?.path;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileSystem = (context as any).adapters?.fileSystem;

  // Track the last loaded SHA to prevent redundant loads
  const lastLoadedSha = useRef<string | undefined>(undefined);

  const loadSkills = useCallback(async () => {
    // Skip if we've already loaded this exact data
    if (fileTreeSha === lastLoadedSha.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let repoSkills: Skill[] = [];

      if (fileTree && fileSystem?.readFile && repoPath) {
        // Detect if this is a GitHub repo (path doesn't start with /)
        const isGithubRepo = !repoPath.startsWith('/');

        if (!isGithubRepo) {
          console.warn('[useSkillsBrowseData] Not a GitHub repo, skipping skill load');
          setSkills(EMPTY_SKILLS_ARRAY);
          lastLoadedSha.current = fileTreeSha;
          setIsLoading(false);
          return;
        }

        // Find all SKILL.md files in the repository (browser mode = true)
        const skillPaths = findSkillFiles(fileTree, true);

        // Read content for each skill
        const skillPromises = skillPaths.map(async (skillPath) => {
          try {
            // Use the relative path directly (GitHub adapter expects this)
            const content = await fileSystem.readFile(skillPath);
            return parseSkillContent(content as string, skillPath, fileTree, fileSystem, true);
          } catch (err) {
            console.error(`[useSkillsBrowseData] Failed to read skill at ${skillPath}:`, err);
            return null;
          }
        });

        repoSkills = (await Promise.all(skillPromises)).filter(
          (skill): skill is Skill => skill !== null
        );
      }

      setSkills(repoSkills);

      // Update tracking ref
      lastLoadedSha.current = fileTreeSha;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load skills';
      setError(errorMessage);
      console.error('[useSkillsBrowseData] Error loading skills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fileTree, fileTreeSha, repoPath, fileSystem]);

  const refreshSkills = useCallback(async () => {
    // Force reload by clearing the tracking ref
    lastLoadedSha.current = undefined;
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
