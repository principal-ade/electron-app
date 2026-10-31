/** A partial download is not a usable skill, even if supporting files arrived. */
export function hasSkillEntrypoint(
  skillPath: string,
  files: ReadonlyArray<{ path: string; content: string }>,
): boolean {
  const entrypoint = `${skillPath.replace(/\/+$/, '')}/SKILL.md`;
  return files.some(
    (file) => file.path === entrypoint && file.content.trim().length > 0,
  );
}
