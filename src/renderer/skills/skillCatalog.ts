/**
 * The skill catalog: every skill the app advertises, where it ships from, and
 * how to install it.
 *
 * Shared by the Home view (first-run skill pills) and the onboarding wizard's
 * install-skills step, so both surfaces offer the same set and use the same
 * install path.
 */
import React from 'react';
import { Boxes, Compass, Network, PenTool, Plug, Plus } from 'lucide-react';
import { TopicsIcon } from '../components/TopicsIcon';
import { GithubService } from '../main-process-api/GithubService';
import { SkillLockService } from '../main-process-api/SkillLockService';
import type { SkillLockFile } from '../../shared/main-process-api-interfaces/SkillLockAPI';
import type { InstallSkillOptions } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';

/**
 * A public GitHub repo that hosts one or more advertised skills. Most ship from
 * the shared principal-ai/skills repo, but a skill may live in the repo that
 * owns it (e.g. create-subsystem-model in principal-ai/subsystem-modeling).
 */
export interface SkillRepo {
  owner: string;
  name: string;
  branch: string;
}

export const SKILLS_REPO: SkillRepo = {
  owner: 'principal-ai',
  name: 'skills',
  branch: 'main',
};
export const SUBSYSTEM_MODELING_REPO: SkillRepo = {
  owner: 'principal-ai',
  name: 'subsystem-modeling',
  branch: 'main',
};

export function skillRepoUrl(repo: SkillRepo): string {
  return `https://github.com/${repo.owner}/${repo.name}`;
}

// Normalized "owner/repo" source recorded in the skill lock file. Used to
// confirm an installed skill came from the expected repo, not just that *some*
// skill of the same name is present — see matchInstalledFromLock.
export function skillRepoSource(repo: SkillRepo): string {
  return `${repo.owner}/${repo.name}`;
}

/** Subset of GitHub's tree entries the install flow needs. */
export type GitHubTreeEntry = {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
};

/** GitHub tree URL for the skill's folder, opened by clicking an installed badge. */
export function skillFolderUrl(skill: {
  repo: SkillRepo;
  path: string;
}): string {
  return `${skillRepoUrl(skill.repo)}/tree/${skill.repo.branch}/${skill.path}`;
}

/** Display metadata shared by required and optional skill entries. */
export interface SkillDetail {
  name: string;
  title: string;
  description: string;
  /** GitHub tree URL for the skill folder. */
  url: string;
  /**
   * Repo the skill ships from. Its "owner/repo" is the lock file `source`: a
   * lock entry only counts as *this* skill when the recorded source matches —
   * the lock file keys by bare name, so a same-named skill from another repo
   * would otherwise read as installed. See matchInstalledFromLock.
   */
  repo: SkillRepo;
  /** Path to the skill folder inside `repo` (nested for monorepo layouts). */
  path: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

/** Catalog entry input — the folder URL is derived from the repo and path. */
export function defineSkill(skill: Omit<SkillDetail, 'url'>): SkillDetail {
  return { ...skill, url: skillFolderUrl(skill) };
}

export const TOPIC_SKILL_NAMES = ['create-topic', 'topic-context'] as const;

// Optional skills are installed individually. They surface in the Home view
// footer as add-ons, and show up among the "Installed Skills" badges once
// present.
export const OPTIONAL_SKILL_NAMES = [
  'excalidraw-drawings',
  'principal-ai-desktop-app-tools',
  'file-city-tours',
  'create-subsystem-model',
  'create-c4-sketch',
] as const;

const CREATE_TOPIC_SKILL = defineSkill({
  name: 'create-topic',
  title: 'Create Topic',
  description:
    'Create a topic — a subject brief scoped to its declared projects, with a description that doubles as the working brief for agents pointed at it.',
  repo: SKILLS_REPO,
  path: 'create-topic',
  Icon: Plus,
});

const TOPIC_CONTEXT_SKILL = defineSkill({
  name: 'topic-context',
  title: 'Topic Context',
  description:
    'Read the topic an agent was briefed on and keep its description current — fetch the topic, append discovered context, or replace a status section in place.',
  repo: SKILLS_REPO,
  path: 'topic-context',
  Icon: TopicsIcon,
});

const DESKTOP_APP_TOOLS_SKILL = defineSkill({
  name: 'principal-ai-desktop-app-tools',
  title: 'Principal Desktop App Tools',
  description: `Canonical reference for the app's local bridge — the HTTP surface at ${getPrincipalBridgeUrl()} that agents use to create topics and leave notes on documents, plus the conventions every call shares.`,
  repo: SKILLS_REPO,
  path: 'principal-ai-desktop-app-tools',
  Icon: Plug,
});

const SUBSYSTEM_MODEL_SKILL = defineSkill({
  name: 'create-subsystem-model',
  title: 'Subsystem Models',
  description:
    'Author a subsystem model — named components, package/module containment, and runtime trails for one subsystem — then create it and open it in Subsystems Studio via the Principal Studio CLI.',
  // Ships from the subsystem-modeling repo, which owns the skill.
  repo: SUBSYSTEM_MODELING_REPO,
  path: 'skills/create-subsystem-model',
  Icon: Boxes,
});

const CREATE_C4_SKETCH_SKILL = defineSkill({
  name: 'create-c4-sketch',
  title: 'C4 Sketches',
  description:
    'Author a standalone C4 architecture sketch — containers, components, external systems, people, and authored edges — then create or open it in Subsystems Studio through the local HTTP API.',
  // Ships from the subsystem-modeling repo alongside the subsystem model skill.
  repo: SUBSYSTEM_MODELING_REPO,
  path: 'skills/create-c4-sketch',
  Icon: Network,
});

const EXCALIDRAW_DRAWINGS_SKILL = defineSkill({
  name: 'excalidraw-drawings',
  title: 'Excalidraw Drawings',
  description:
    "Find and edit the app's Excalidraw drawings on disk — locate the .excalidraw JSON under ~/.alexandria/drawings and edit a diagram directly so an agent can collaborate on it.",
  repo: SKILLS_REPO,
  path: 'excalidraw-drawings',
  Icon: PenTool,
});

const FILE_CITY_TOURS_SKILL = defineSkill({
  name: 'file-city-tours',
  title: 'File City Tours',
  description:
    "Create and validate guided introduction tours for File City visualizations — build onboarding walkthroughs that highlight a codebase's architecture with interactive highlights, actions, and color modes.",
  repo: SKILLS_REPO,
  path: 'file-city-tours',
  Icon: Compass,
});

/**
 * Every skill the app knows how to display or install, in display order: the
 * two app-integration skills lead, then the topic skills, then the remaining
 * add-ons. Surfaces that list skills (Home view badges, the onboarding
 * install-skills step) read this order rather than defining their own.
 */
export const ALL_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  DESKTOP_APP_TOOLS_SKILL,
  CREATE_TOPIC_SKILL,
  CREATE_C4_SKETCH_SKILL,
  SUBSYSTEM_MODEL_SKILL,
  TOPIC_CONTEXT_SKILL,
  EXCALIDRAW_DRAWINGS_SKILL,
  FILE_CITY_TOURS_SKILL,
];

const isTopicSkill = (skill: SkillDetail) =>
  TOPIC_SKILL_NAMES.includes(skill.name as (typeof TOPIC_SKILL_NAMES)[number]);

const isOptionalSkill = (skill: SkillDetail) =>
  OPTIONAL_SKILL_NAMES.includes(
    skill.name as (typeof OPTIONAL_SKILL_NAMES)[number],
  );

/** The topic skills, in catalog display order. */
export const TOPIC_SKILL_DETAILS = ALL_SKILL_DETAILS.filter(isTopicSkill);

/** Individually installable add-ons, in catalog display order. */
export const OPTIONAL_SKILL_DETAILS = ALL_SKILL_DETAILS.filter(isOptionalSkill);

/** Names whose install state the app tracks (required + optional). */
export const TRACKED_SKILL_NAMES: ReadonlyArray<string> = [
  ...TOPIC_SKILL_NAMES,
  ...OPTIONAL_SKILL_NAMES,
];

/**
 * Resolve which tracked skills are installed *from the repo we advertise*.
 *
 * The lock file keys entries by bare skill name, so presence-of-key alone can't
 * tell our `file-city-tours` (principal-ai/skills) apart from a same-named skill
 * installed from somewhere else (e.g. a stale principal-ai/file-city install). We
 * additionally require the recorded `entry.source` to equal the catalog entry's
 * source, so the badge reflects *our* skill rather than any skill that happens to
 * share the name. Identity here is (name, source), even though storage still keys
 * by name.
 */
export function matchInstalledFromLock(
  lockFile: SkillLockFile | null,
): Set<string> {
  if (!lockFile) return new Set();
  return new Set(
    ALL_SKILL_DETAILS.filter((skill) => {
      const entry = lockFile.skills[skill.name];
      return entry != null && entry.source === skillRepoSource(skill.repo);
    }).map((skill) => skill.name),
  );
}

/** Names of catalog skills installed from their advertised repo. */
export async function getInstalledCatalogSkillNames(): Promise<Set<string>> {
  try {
    const [lockFile, skills] = await Promise.all([
      SkillLockService.getLockFile(),
      SkillLockService.getInstalledSkills(),
    ]);
    const fromSource = matchInstalledFromLock(lockFile);
    return new Set(
      skills
        .filter(
          (skill) => skill.available === true && fromSource.has(skill.name),
        )
        .map((skill) => skill.name),
    );
  } catch (error) {
    console.error('[skillCatalog] Failed to read the skill lock file:', error);
    return new Set();
  }
}

/**
 * Destinations every catalog install writes to: the canonical (universal) agent
 * directory and the Claude-specific one. Mirrors
 * `DIRECTORY_ID_TO_DESTINATION['agent-universal' | 'claude-specific']`.
 */
const INSTALL_DESTINATIONS: ReadonlyArray<InstallSkillOptions['destination']> =
  ['global-claude', 'global-universal'];

export interface SkillInstallResult {
  /** Names that installed successfully into at least one destination. */
  installed: string[];
  /** Human-readable per-skill/per-destination failures. */
  failures: string[];
}

/**
 * Install catalog skills from GitHub.
 *
 * Fetches each source repo's tree once (grouped by repo), then writes every
 * selected skill into the canonical and Claude-specific directories. A skill
 * counts as installed when at least one destination succeeds.
 */
export async function installSkills(
  skills: ReadonlyArray<SkillDetail>,
  options?: {
    destinations?: ReadonlyArray<InstallSkillOptions['destination']>;
  },
): Promise<SkillInstallResult> {
  const destinations = options?.destinations ?? INSTALL_DESTINATIONS;
  const failures: string[] = [];
  const installed = new Set<string>();

  const byRepo = new Map<string, { repo: SkillRepo; skills: SkillDetail[] }>();
  for (const skill of skills) {
    const key = skillRepoSource(skill.repo);
    const group = byRepo.get(key) ?? { repo: skill.repo, skills: [] };
    group.skills.push(skill);
    byRepo.set(key, group);
  }

  for (const { repo, skills: repoSkills } of byRepo.values()) {
    const githubUrl = skillRepoUrl(repo);
    let tree: GitHubTreeEntry[] = [];
    try {
      const treeResult = await GithubService.getTree(
        repo.owner,
        repo.name,
        repo.branch,
      );
      if (!treeResult?.success || !treeResult.data) {
        throw new Error(
          `Could not fetch the ${repo.owner}/${repo.name} repository tree.`,
        );
      }
      tree = treeResult.data.tree;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'tree fetch failed';
      for (const skill of repoSkills) {
        failures.push(`${skill.name}: ${reason}`);
      }
      continue;
    }

    for (const skill of repoSkills) {
      const prefix = `${skill.path}/`;
      const fileList = tree
        .filter((item) => item.type === 'blob' && item.path.startsWith(prefix))
        .map((item) => item.path);
      if (!fileList.includes(`${skill.path}/SKILL.md`)) {
        failures.push(
          `${skill.name}: SKILL.md not found at ${skill.path} in ${skillRepoSource(repo)}`,
        );
        continue;
      }
      const folderEntry = tree.find(
        (item) => item.type === 'tree' && item.path === skill.path,
      );

      let succeededOnce = false;
      for (const destination of destinations) {
        const result = await GithubService.installSkill({
          githubUrl,
          skillPath: skill.path,
          destination,
          skillName: skill.name,
          fileList,
          skillTreeSha: folderEntry?.sha,
        });
        if (result.success) {
          succeededOnce = true;
        } else {
          failures.push(
            `${skill.name} → ${destination}: ${result.error || 'failed'}`,
          );
        }
      }
      if (succeededOnce) {
        installed.add(skill.name);
      }
    }
  }

  return { installed: [...installed], failures };
}
