import { FileSystemService } from '../../../main-process-api/FileSystemService';

/**
 * LocalSkillsFileSystemAdapter - Adapter to read installed skills from local filesystem
 *
 * Maps virtual skill paths (source/skill-name/file.md) to actual filesystem paths
 * (~/.claude/skills/skill-name/file.md) and reads the content.
 */
export class LocalSkillsFileSystemAdapter {
  private skillsMap: Map<string, { path: string; name: string; source: string }>;

  constructor(skills: Array<{ path: string; name: string; source: string }>) {
    // Create a map for quick lookup: "source/name" -> skill info
    this.skillsMap = new Map();
    for (const skill of skills) {
      const key = `${skill.source}/${skill.name}`;
      this.skillsMap.set(key, skill);
    }
  }

  /**
   * Read file content from local filesystem
   * @param path - Virtual path like "claude/setup-otel-testing/SKILL.md"
   */
  async readFile(path: string): Promise<string> {
    try {
      // Parse the virtual path: source/skill-name/file.md
      const parts = path.split('/');

      if (parts.length < 3) {
        throw new Error(`Invalid skill path format: ${path}`);
      }

      const source = parts[0]; // e.g., "claude"
      const skillName = parts[1]; // e.g., "setup-otel-testing"
      const filePath = parts.slice(2).join('/'); // e.g., "SKILL.md"

      // Look up the skill in our map
      const skillKey = `${source}/${skillName}`;
      const skill = this.skillsMap.get(skillKey);

      if (!skill) {
        throw new Error(`Skill not found: ${skillKey}`);
      }

      // Construct the actual filesystem path
      // skill.path is the full directory path (e.g., /Users/user/.claude/skills/setup-otel-testing)
      const actualPath = `${skill.path}/${filePath}`;

      console.log('[LocalSkillsFileSystemAdapter] Reading file:', {
        virtualPath: path,
        actualPath,
        source,
        skillName,
        filePath,
      });

      // Read from local filesystem
      const content = await FileSystemService.readFile(actualPath);

      console.log('[LocalSkillsFileSystemAdapter] Successfully read file:', {
        path: actualPath,
        contentLength: content.length,
      });

      return content;
    } catch (error) {
      console.error(`[LocalSkillsFileSystemAdapter] Failed to read ${path}:`, error);
      throw error;
    }
  }

  /**
   * Update the skills list (called when skills are refreshed)
   */
  updateSkills(skills: Array<{ path: string; name: string; source: string }>) {
    this.skillsMap.clear();
    for (const skill of skills) {
      const key = `${skill.source}/${skill.name}`;
      this.skillsMap.set(key, skill);
    }
  }
}
