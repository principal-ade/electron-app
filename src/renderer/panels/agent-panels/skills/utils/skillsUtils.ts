import type { FileTree } from '@principal-ai/repository-abstraction';
import type { FileSystemAdapter } from '@principal-ade/panel-framework-core';
import type { Skill, SkillSource, FrontmatterValidation } from '../hooks/useSkillsData';

/**
 * Helper function to determine skill source and priority from path
 */
export const determineSkillSource = (path: string): { source: SkillSource; priority: 1 | 2 | 3 | 4 | 5 } => {
  if (path.includes('.agent/skills/')) {
    return { source: 'project-universal', priority: 1 };
  } else if (path.includes('.claude/skills/')) {
    return { source: 'project-claude', priority: 3 };
  } else if (path.includes('skills/')) {
    // Treat top-level skills/ directory same as .agent/skills/ (priority 1)
    return { source: 'project-other', priority: 1 };
  } else {
    return { source: 'project-other', priority: 5 };
  }
};

/**
 * Helper function to find skill markdown files from the FileTree's allFiles array
 * Looks for any .md files in .agent/skills/ or .claude/skills/ directories (local mode)
 * or SKILL.md files anywhere in the tree (browser mode for GitHub repositories)
 */
export const findSkillFiles = (fileTree: FileTree, isBrowserMode: boolean = false): string[] => {
  // Filter allFiles for .md files in skill directories
  const skillFiles = fileTree.allFiles.filter(file => {
    const path = file.relativePath;
    const isMarkdown = file.name.endsWith('.md');

    // Exclude metadata files
    const isMetadata = file.name === '.metadata.json' || file.name.startsWith('.');

    if (isMetadata) {
      return false;
    }

    // In browser mode (GitHub repos), look for SKILL.md files anywhere
    if (isBrowserMode) {
      return file.name === 'SKILL.md' || file.name.toLowerCase() === 'skill.md';
    }

    // In local mode, look for .md files in .agent/skills/, .claude/skills/, or skills/
    const isInSkillDir = path.includes('.agent/skills/') || path.includes('.claude/skills/') || path.includes('skills/');
    return isMarkdown && isInSkillDir;
  });

  // Return their relative paths
  return skillFiles.map(file => file.relativePath);
};

/**
 * Helper function to analyze skill folder structure
 */
export const analyzeSkillStructure = (fileTree: FileTree, skillPath: string) => {
  // Get skill directory path (parent of skill markdown file)
  const skillDir = skillPath.substring(0, skillPath.lastIndexOf('/'));
  const pathParts = skillPath.split('/');
  const parentDir = pathParts[pathParts.length - 2];

  // Check if this is a standalone file directly in the skills directory
  const isStandaloneFile = parentDir === 'skills';

  // For standalone files, there's no skill-specific folder structure
  if (isStandaloneFile) {
    return {
      skillFolderPath: skillDir,
      hasScripts: false,
      hasReferences: false,
      hasAssets: false,
      scriptFiles: [],
      referenceFiles: [],
      assetFiles: [],
    };
  }

  // For skills in subdirectories, analyze the folder structure
  // Find all files in the skill directory
  const skillFiles = fileTree.allFiles.filter(file =>
    file.relativePath.startsWith(`${skillDir}/`)
  );

  // Detect folder structure
  const scriptFiles = skillFiles
    .filter(f => f.relativePath.startsWith(`${skillDir}/scripts/`))
    .map(f => f.name);

  const referenceFiles = skillFiles
    .filter(f => f.relativePath.startsWith(`${skillDir}/references/`))
    .map(f => f.name);

  const assetFiles = skillFiles
    .filter(f => f.relativePath.startsWith(`${skillDir}/assets/`))
    .map(f => f.name);

  return {
    skillFolderPath: skillDir,
    hasScripts: scriptFiles.length > 0,
    hasReferences: referenceFiles.length > 0,
    hasAssets: assetFiles.length > 0,
    scriptFiles,
    referenceFiles,
    assetFiles,
  };
};

/**
 * Helper function to validate YAML frontmatter structure and required fields
 * Now validates gracefully - considers skills valid even with missing required fields
 */
export const validateFrontmatter = (content: string): FrontmatterValidation => {
  const trimmedContent = content.trim();

  // Check if content starts with ---
  if (!trimmedContent.startsWith('---')) {
    return {
      isValid: true, // Still valid, just has warnings
      hasStructure: false,
      missingFields: [],
      errorMessage: 'Missing YAML frontmatter (must start with ---)',
    };
  }

  const lines = trimmedContent.split('\n');

  // Find closing ---
  let frontmatterEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      frontmatterEnd = i;
      break;
    }
  }

  // Valid frontmatter must have closing ---
  if (frontmatterEnd <= 0) {
    return {
      isValid: true, // Still valid, just has warnings
      hasStructure: false,
      missingFields: [],
      errorMessage: 'Missing closing --- delimiter for frontmatter',
    };
  }

  // Extract frontmatter content
  const frontmatterLines = lines.slice(1, frontmatterEnd);
  const frontmatterText = frontmatterLines.join('\n');

  // Check for required fields: name and description
  const missingFields: string[] = [];

  const hasName = /^name:\s*.+/m.test(frontmatterText);
  const hasDescription = /^description:\s*.+/m.test(frontmatterText);

  if (!hasName) {
    missingFields.push('name');
  }
  if (!hasDescription) {
    missingFields.push('description');
  }

  // Construct warning message if there are missing fields
  let errorMessage: string | undefined;
  if (missingFields.length > 0) {
    const fieldList = missingFields.map(f => `'${f}'`).join(', ');
    errorMessage = `Missing required field${missingFields.length > 1 ? 's' : ''}: ${fieldList}`;
  }

  return {
    isValid: true, // Always valid - we show warnings but don't block rendering
    hasStructure: true,
    missingFields,
    errorMessage,
  };
};

/**
 * Helper function to parse skill markdown content and extract metadata
 */
export const parseSkillContent = async (
  content: string,
  path: string,
  fileTree: FileTree,
  fileSystemAdapter?: Pick<FileSystemAdapter, 'readFile'>,
  isBrowserMode: boolean = false
): Promise<Skill> => {
  // Extract skill name from path
  const pathParts = path.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const parentDir = pathParts[pathParts.length - 2];

  // If the file is directly in a skills directory, use the filename as the skill name
  // Otherwise, use the parent directory name (for skills in subdirectories)
  const isDirectlyInSkillsDir = parentDir === 'skills';
  const skillDirName = isDirectlyInSkillsDir
    ? fileName.replace(/\.md$/, '') // Remove .md extension
    : parentDir;

  // Try to extract description from the first paragraph after a heading
  let description = '';
  const lines = content.split('\n');
  let foundHeading = false;

  for (const line of lines) {
    if (line.startsWith('#')) {
      foundHeading = true;
      continue;
    }
    if (foundHeading && line.trim() && !line.startsWith('#')) {
      description = line.trim();
      break;
    }
  }

  // Extract capabilities (look for bullet points or numbered lists)
  const capabilities: string[] = [];
  for (const line of lines) {
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (bulletMatch) {
      capabilities.push(bulletMatch[1].trim());
    }
  }

  // Analyze skill folder structure
  const structure = analyzeSkillStructure(fileTree, path);

  // Determine source and priority
  const { source, priority } = determineSkillSource(path);

  // Try to read .metadata.json if it exists (only in local mode)
  // In browser mode, metadata files don't exist in remote repositories
  let metadata = undefined;
  if (!isBrowserMode && fileSystemAdapter && structure.skillFolderPath) {
    try {
      const metadataPath = `${structure.skillFolderPath}/.metadata.json`;
      const metadataContent = await fileSystemAdapter.readFile(metadataPath);
      metadata = JSON.parse(metadataContent);
    } catch {
      // .metadata.json doesn't exist or couldn't be read - this is fine
    }
  }

  // Validate frontmatter
  const frontmatterValidation = validateFrontmatter(content);

  return {
    id: path,
    name: skillDirName.replace(/-/g, ' ').replace(/_/g, ' '),
    path,
    description: description || 'No description available',
    content,
    capabilities: capabilities.slice(0, 3), // Limit to first 3 capabilities
    ...structure,
    source,
    priority,
    metadata,
    frontmatterValidation,
  };
};
