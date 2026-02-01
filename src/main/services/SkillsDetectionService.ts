import { app } from 'electron';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

/**
 * Preset directory configuration for different AI assistants
 */
export interface PresetDirectory {
  id: string;
  path: string;
  displayName: string;
  description: string;
  icon: string;
}

/**
 * Detected directory with skill count
 */
export interface DetectedDirectory extends PresetDirectory {
  skillCount: number;
  skills: string[];
}

/**
 * Local skill information
 */
export interface LocalSkill {
  path: string;
  name: string;
  source: 'agents' | 'claude' | 'opencode' | 'cursor' | 'windsurf';
}

/**
 * Predefined skill directory presets for different AI assistants
 */
const PRESET_SKILL_DIRECTORIES: PresetDirectory[] = [
  {
    id: 'agent-universal',
    path: '{HOME}/.agents/skills',
    displayName: 'Agents',
    description: 'Universal agent skills compatible with all AI assistants',
    icon: '🤖',
  },
  {
    id: 'claude-specific',
    path: '{HOME}/.claude/skills',
    displayName: 'Claude',
    description: 'Claude-specific skills for Anthropic\'s Claude',
    icon: '🎯',
  },
  {
    id: 'opencode',
    path: '{HOME}/.config/opencode/skill',
    displayName: 'OpenCode',
    description: 'Skills for OpenCode AI assistant',
    icon: '💻',
  },
  {
    id: 'cursor-ide',
    path: '{HOME}/.cursor/skills',
    displayName: 'Cursor',
    description: 'Skills for Cursor IDE AI assistant',
    icon: '⌨️',
  },
  {
    id: 'windsurf',
    path: '{HOME}/.windsurf/skills',
    displayName: 'Windsurf',
    description: 'Skills for Windsurf AI assistant',
    icon: '🌊',
  },
];

/**
 * Service for detecting and managing skill directories
 * Handles discovery of skills across different AI assistant directories
 */
export class SkillsDetectionService {
  private homeDir: string;

  constructor() {
    this.homeDir = app.getPath('home');
  }

  /**
   * Get all preset directory configurations
   */
  getPresets(): PresetDirectory[] {
    return PRESET_SKILL_DIRECTORIES.map(preset => ({
      ...preset,
      path: preset.path.replace('{HOME}', this.homeDir),
    }));
  }

  /**
   * Check if a directory contains valid skills
   * A valid skill is a directory containing a SKILL.md file
   */
  private async findSkillsInDirectory(dirPath: string): Promise<string[]> {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    try {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
      const skills: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(dirPath, entry.name);
          const skillMdPath = path.join(skillPath, 'SKILL.md');

          if (fs.existsSync(skillMdPath)) {
            skills.push(entry.name);
          }
        }
      }

      return skills;
    } catch (error) {
      console.warn(`[SkillsDetection] Error reading directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Detect which preset directories exist and contain skills
   * Only returns directories that:
   * 1. Exist on the filesystem
   * 2. Contain at least one valid skill (directory with SKILL.md)
   */
  async detectPresetDirectories(): Promise<DetectedDirectory[]> {
    const detectedDirs: DetectedDirectory[] = [];

    for (const preset of PRESET_SKILL_DIRECTORIES) {
      const dirPath = preset.path.replace('{HOME}', this.homeDir);
      const skills = await this.findSkillsInDirectory(dirPath);

      if (skills.length > 0) {
        detectedDirs.push({
          ...preset,
          path: dirPath,
          skillCount: skills.length,
          skills,
        });
      }
    }

    console.log(`[SkillsDetection] Found ${detectedDirs.length} directories with skills`);
    return detectedDirs;
  }

  /**
   * Get all local skills from standard directories
   * Scans ~/.agents/skills and ~/.claude/skills for skill directories
   * Returns full path information for each skill
   */
  async getAllLocalSkills(): Promise<LocalSkill[]> {
    const skillDirs: LocalSkill[] = [];

    // Helper to find skill directories
    const findSkillDirs = async (baseDir: string, source: LocalSkill['source']) => {
      try {
        if (!fs.existsSync(baseDir)) {
          return;
        }

        const entries = await fsPromises.readdir(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = path.join(baseDir, entry.name);
            // Check if it contains SKILL.md or any .md file
            const files = await fsPromises.readdir(skillPath);
            if (files.some(f => f.endsWith('.md'))) {
              skillDirs.push({
                path: skillPath,
                name: entry.name,
                source,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`[SkillsDetection] Error reading ${baseDir}:`, error);
      }
    };

    // Scan primary directories
    await findSkillDirs(path.join(this.homeDir, '.agents', 'skills'), 'agents');
    await findSkillDirs(path.join(this.homeDir, '.claude', 'skills'), 'claude');
    await findSkillDirs(path.join(this.homeDir, '.config', 'opencode', 'skill'), 'opencode');
    await findSkillDirs(path.join(this.homeDir, '.cursor', 'skills'), 'cursor');
    await findSkillDirs(path.join(this.homeDir, '.windsurf', 'skills'), 'windsurf');

    console.log(`[SkillsDetection] Found ${skillDirs.length} total skills`);
    return skillDirs;
  }

  /**
   * Check if a specific preset directory exists
   */
  async directoryExists(presetId: string): Promise<boolean> {
    const preset = PRESET_SKILL_DIRECTORIES.find(p => p.id === presetId);
    if (!preset) {
      return false;
    }

    const dirPath = preset.path.replace('{HOME}', this.homeDir);
    return fs.existsSync(dirPath);
  }

  /**
   * Get the absolute path for a preset directory
   */
  getPresetPath(presetId: string): string | null {
    const preset = PRESET_SKILL_DIRECTORIES.find(p => p.id === presetId);
    if (!preset) {
      return null;
    }

    return preset.path.replace('{HOME}', this.homeDir);
  }
}
