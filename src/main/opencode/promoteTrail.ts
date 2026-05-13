import { promises as fs } from 'fs';
import type { PromoteProgressEntry } from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';
import { getTrailStore } from '../file-city/trailStore';
import { getPrincipalMCPBridge } from '../principal-mcp/PrincipalMCPBridge';
import { runOpenCodePrompt } from './openCodeRunner';

export interface PromoteTrailOpts {
  onProgress?: (entry: PromoteProgressEntry) => void;
}

export interface PromoteTrailResult {
  ok: boolean;
  newTrailId?: string;
  derivedFrom?: string;
  raw?: string;
  sessionId?: string;
  durationMs: number;
  error?: string;
}

const SKILL_PATH =
  '/Users/griever/Developer/skills/promote-investigation/SKILL.md';

async function loadSkillContent(): Promise<string> {
  try {
    return await fs.readFile(SKILL_PATH, 'utf8');
  } catch {
    return '';
  }
}

const AGENT_DIRECTIVE = `\n\n---\n\nYou are running this skill in agent mode against the local Principal MCP Bridge on http://localhost:3044. Use your bash/curl tool to call the bridge. Follow the skill's workflow exactly: fetch the source, identify the subject, author the informative payload, POST to /api/file-city/trail/fork-informative, loop on validation errors (max 5 attempts). When the POST succeeds (success: true), reply with a final line in this exact form:\n\nRESULT_OK: <newTrailId>\n\nIf you give up after retries, reply with:\n\nRESULT_FAIL: <last error message>\n`;

function parseAgentResult(
  text: string,
): { ok: true; newTrailId: string } | { ok: false; error: string } | null {
  const okMatch = /RESULT_OK:\s*([^\s\n]+)/i.exec(text);
  if (okMatch) return { ok: true, newTrailId: okMatch[1].trim() };
  const failMatch = /RESULT_FAIL:\s*([^\n]+)/i.exec(text);
  if (failMatch) return { ok: false, error: failMatch[1].trim() };
  return null;
}

export async function promoteTrail(
  trailId: string,
  opts: PromoteTrailOpts = {},
): Promise<PromoteTrailResult> {
  const started = Date.now();

  const store = getTrailStore();
  const loaded = await store.loadByIdWithRepoPath(trailId);
  if (!loaded) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: `trail ${trailId} not found`,
    };
  }
  const { repositoryPath } = loaded;

  // Snapshot existing ids so we can detect the new trail even if the agent's
  // final-line contract isn't followed exactly.
  const before = await store.list(repositoryPath);
  const beforeIds = new Set(before.entries.map((e) => e.id));

  const skillContent = await loadSkillContent();
  if (!skillContent) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: `skill not found at ${SKILL_PATH}`,
    };
  }

  // Read the live bridge port — dev builds run on 3054, prod on 3044, and
  // either could be remapped. The skill's docs default to 3044, but we
  // override here so the agent always targets the bridge instance that's
  // actually running.
  const bridgePort = getPrincipalMCPBridge().getPort();
  const bridgeUrl = `http://localhost:${bridgePort}`;

  const systemPrompt = `${skillContent}${AGENT_DIRECTIVE}`;
  const userPrompt = `Promote investigation trail with sourceId: ${trailId}.\nrepositoryPath: ${repositoryPath ?? '(unset)'}.\nThe Principal MCP Bridge is running at ${bridgeUrl} — use this base URL for ALL HTTP calls (overrides whatever default URL the skill documents). Follow the skill above.`;

  const runResult = await runOpenCodePrompt({
    prompt: userPrompt,
    system: systemPrompt,
    cwd: repositoryPath,
    timeoutMs: 5 * 60_000,
    onProgress: opts.onProgress,
  });

  if (!runResult.ok) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      sessionId: runResult.sessionId,
      raw: runResult.text,
      error: runResult.error ?? 'agent run failed',
    };
  }

  const raw = runResult.text ?? '';
  const parsed = parseAgentResult(raw);

  // Verify by inspecting the index. If a new trail with derivedFrom=trailId
  // appeared since we started, the fork really happened — regardless of
  // whether the agent emitted the marker line.
  const after = await store.list(repositoryPath);
  const newEntry = after.entries.find(
    (e) => !beforeIds.has(e.id) && e.derivedFrom === trailId,
  );

  if (newEntry) {
    return {
      ok: true,
      newTrailId: newEntry.id,
      derivedFrom: trailId,
      raw,
      sessionId: runResult.sessionId,
      durationMs: Date.now() - started,
    };
  }

  if (parsed && parsed.ok) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      sessionId: runResult.sessionId,
      raw,
      error: `agent claimed success (id=${parsed.newTrailId}) but no matching index entry was created`,
    };
  }

  return {
    ok: false,
    durationMs: Date.now() - started,
    sessionId: runResult.sessionId,
    raw,
    error: parsed
      ? parsed.error
      : 'agent finished without creating a new informative trail',
  };
}
