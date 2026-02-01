/**
 * Skill Lock File API
 *
 * Implements the add-skill lock file convention for tracking installed skills.
 * See: https://github.com/vercel-labs/add-skill
 *
 * Lock file location: ~/.agents/.skill-lock.json
 */

export const SKILL_LOCK_VERSION = 3;
export const SKILL_LOCK_PATH = '.agents/.skill-lock.json'; // Relative to home directory

export enum SkillLockAPIEvent {
  // Lock file operations
  GET_SKILL_LOCK = 'skill-lock:get',
  ADD_SKILL_TO_LOCK = 'skill-lock:add',
  REMOVE_SKILL_FROM_LOCK = 'skill-lock:remove',
  UPDATE_SKILL_IN_LOCK = 'skill-lock:update',

  // Update checking
  CHECK_SKILL_UPDATES = 'skill-lock:check-updates',
  GET_INSTALLED_SKILLS = 'skill-lock:get-installed',

  // Update operations
  UPDATE_SKILL = 'skill-lock:update-skill',
  UPDATE_ALL_SKILLS = 'skill-lock:update-all',
}

/**
 * Source type for a skill installation
 */
export type SkillSourceType = 'github' | 'mintlify' | 'huggingface' | 'local';

/**
 * Individual skill entry in the lock file
 * Matches the add-skill convention: https://github.com/vercel-labs/add-skill
 */
export interface SkillLockEntry {
  /** Normalized source identifier (e.g., "owner/repo", "mintlify/bun.com") */
  source: string;

  /** The provider/source type (e.g., "github", "mintlify", "huggingface", "local") */
  sourceType: SkillSourceType;

  /** The original URL used to install the skill (for re-fetching updates) */
  sourceUrl: string;

  /** Subpath within the source repo, if applicable */
  skillPath?: string;

  /**
   * GitHub tree SHA for the entire skill folder.
   * This hash changes when ANY file in the skill folder changes.
   */
  skillFolderHash: string;

  /** ISO timestamp when the skill was first installed */
  installedAt: string;

  /** ISO timestamp when the skill was last updated */
  updatedAt: string;

  /**
   * Canonical path where the actual skill files are stored.
   * For global installs: ~/.agents/skills/{skillName}
   * Agent directories contain symlinks to this path.
   */
  canonicalPath?: string;
}

/**
 * Lock file schema (v3)
 */
export interface SkillLockFile {
  /** Schema version */
  version: typeof SKILL_LOCK_VERSION;

  /** Installed skills keyed by skill name */
  skills: Record<string, SkillLockEntry>;

  /** Dismissed update prompts (skillName -> dismissedAt timestamp) */
  dismissed?: Record<string, string>;

  /** Last selected agents for UI preference persistence */
  lastSelectedAgents?: string[];
}

/**
 * Result of checking for skill updates
 */
export interface SkillUpdateCheckResult {
  /** Skill name */
  name: string;

  /** Current installed hash */
  installedHash: string;

  /** Latest available hash from source */
  latestHash: string;

  /** Whether an update is available */
  hasUpdate: boolean;

  /** Source URL for the skill */
  sourceUrl: string;

  /** Error if check failed */
  error?: string;
}

/**
 * Options for adding a skill to the lock file
 */
export interface AddSkillToLockOptions {
  /** Skill name (used as key) */
  name: string;

  /** Lock entry data */
  entry: Omit<SkillLockEntry, 'installedAt' | 'updatedAt'>;
}

/**
 * Options for updating a skill in the lock file
 */
export interface UpdateSkillInLockOptions {
  /** Skill name */
  name: string;

  /** Fields to update */
  updates: Partial<Omit<SkillLockEntry, 'installedAt'>>;
}

/**
 * Result of a skill update operation
 */
export interface SkillUpdateResult {
  success: boolean;
  name: string;
  previousHash?: string;
  newHash?: string;
  error?: string;
}

/**
 * Installed skill info for UI display
 */
export interface InstalledSkillInfo {
  name: string;
  source: string;
  sourceType: SkillSourceType;
  sourceUrl: string;
  skillPath?: string;
  skillFolderHash: string;
  installedAt: string;
  updatedAt: string;
  canonicalPath?: string;
}

/**
 * Skill Lock API interface
 */
export interface SkillLockAPI {
  /** Get the entire lock file */
  getSkillLock: () => Promise<SkillLockFile | null>;

  /** Add a skill to the lock file */
  addSkillToLock: (options: AddSkillToLockOptions) => Promise<{ success: boolean; error?: string }>;

  /** Remove a skill from the lock file */
  removeSkillFromLock: (name: string) => Promise<{ success: boolean; error?: string }>;

  /** Update a skill entry in the lock file */
  updateSkillInLock: (options: UpdateSkillInLockOptions) => Promise<{ success: boolean; error?: string }>;

  /** Check for updates on all installed skills */
  checkSkillUpdates: () => Promise<SkillUpdateCheckResult[]>;

  /** Get list of all installed skills from lock file */
  getInstalledSkills: () => Promise<InstalledSkillInfo[]>;

  /** Update a single skill to latest version */
  updateSkill: (name: string) => Promise<SkillUpdateResult>;

  /** Update all skills with available updates */
  updateAllSkills: () => Promise<SkillUpdateResult[]>;
}

/**
 * Create an empty lock file with default values
 */
export function createEmptyLockFile(): SkillLockFile {
  return {
    version: SKILL_LOCK_VERSION,
    skills: {},
  };
}

/**
 * Normalize a GitHub URL to owner/repo format
 */
export function normalizeGitHubSource(url: string): string {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^/]+\/[^/]+)/,
    /^([^/]+\/[^/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace(/\.git$/, '');
    }
  }

  return url;
}
