#!/usr/bin/env node
/**
 * Build the ACP highlight-audit corpus from real OpenCode tool calls.
 *
 * The app's telemetry does not record tool commands yet, so the OpenCode
 * session database is the only place we can recover `{ command, output }`
 * pairs. This script runs each recorded call through the same
 * OpenCodeACPEventProcessor the event worker uses, then applies the event
 * server's workspace-relative filter so the fixture reflects what would
 * actually reach File City.
 *
 * Usage:
 *   node scripts/collect-acp-highlight-corpus.mjs [--limit 60] [--days 60]
 *
 * The output is committed and consumed by AcpHighlightAudit.stories.tsx.
 * Re-run it after changing the extractor or when you want a fresher set of
 * commands. Nothing here runs in the browser or at app runtime.
 */

import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OpenCodeACPEventProcessor } from '@principal-ai/agent-monitoring';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const outputPath = path.join(
  repoRoot,
  'src/renderer/dev-workspace/acp-client/__fixtures__/acpHighlightCorpus.json',
);

const args = process.argv.slice(2);
function numberArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const limit = numberArg('--limit', 60);
const days = numberArg('--days', 60);
const databasePath =
  process.env.OPENCODE_DB ??
  path.join(os.homedir(), '.local/share/opencode/opencode.db');

const CASE_LIMIT_PER_CATEGORY = 8;
const MAX_CONTENT_CHARS = 800;
const MAX_COMMAND_CHARS = 240;
/**
 * Commands worth keeping even when a whole corpus of recent calls would
 * crowd them out. These are the edge cases the audit needs to see: silent
 * bare listings, `cd` chains, globs, and flag-heavy listings.
 */
const SEED_COMMANDS = [
  'ls src/renderer',
  'ls src/renderer/',
  'ls -la src/renderer',
  'ls src/renderer | head',
  'ls src/renderer 2>/dev/null',
  'ls src/*',
  'ls',
  'cd src && ls renderer',
];
const SKIP_COMMAND_PREFIXES = [
  'sqlite3',
  'maple',
  'python3',
  'osascript',
  'ps ',
  'date',
  'open ',
];

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_RE, '');
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  const clean = stripAnsi(text).trim();
  return clean.length > max ? `${clean.slice(0, max)}\n…` : clean;
}

function contentText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      part && typeof part === 'object' && typeof part.text === 'string'
        ? part.text
        : '',
    )
    .filter(Boolean)
    .join('\n');
}

function toolKind(name) {
  switch ((name ?? '').toLowerCase()) {
    case 'read':
      return 'read';
    case 'write':
    case 'edit':
    case 'patch':
    case 'apply_patch':
      return 'edit';
    case 'grep':
    case 'glob':
    case 'rg':
      return 'search';
    case 'ls':
    case 'list':
      return 'read';
    default:
      return 'execute';
  }
}

function commandSegments(command) {
  return command
    .split(/&&|\|\||[;|]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function commandCategory(name, input) {
  if (
    (name ?? '').toLowerCase() !== 'shell' &&
    (name ?? '').toLowerCase() !== 'bash'
  ) {
    return `tool:${name ?? 'unknown'}`;
  }
  const command = String(input?.command ?? '').trim();
  const words = commandSegments(command).map(
    (segment) => segment.split(/\s+/)[0] ?? '',
  );
  if (words.includes('ls')) return 'command:ls';
  if (words.some((word) => word === 'find' || word === 'fd'))
    return 'command:find';
  if (words.some((word) => /^(grep|rg|ag|ack)$/.test(word)))
    return 'command:grep';
  if (words.includes('git')) return 'command:git';
  if (
    words.some((word) =>
      /^(npm|pnpm|yarn|bun|bunx|npx|node|tsc|jest|vitest)$/.test(word),
    )
  )
    return 'command:build-test';
  if (
    words.some((word) =>
      /^(rm|rmdir|mv|cp|mkdir|touch|sed|perl|tee|ln)$/.test(word),
    )
  )
    return 'command:mutate';
  if (
    words.some((word) => /^(cat|head|tail|sed|wc|stat|less|more)$/.test(word))
  )
    return 'command:read';
  return 'command:other';
}

function shellCommand(input) {
  const command = input?.command;
  return typeof command === 'string' ? command.trim() : '';
}

function dedupeKey(call) {
  const name = (call.name ?? 'unknown').toLowerCase();
  if (name === 'shell' || name === 'bash') {
    return `shell:${shellCommand(call.input).replace(/\s+/g, ' ')}`;
  }
  try {
    return `${name}:${JSON.stringify(call.input ?? {})}`;
  } catch {
    return `${name}:${String(call.input)}`;
  }
}

function readCandidates() {
  if (!Database) throw new Error('better-sqlite3 is unavailable');
  const db = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // OpenCode v1 and v2 store sessions in different tables; v2 sessions
  // (including ACP tabs) never appear in `session`.
  const tables = db
    .prepare(
      `select name from sqlite_master
        where type = 'table' and name in ('session', 'session_v2')`,
    )
    .all()
    .map((row) => row.name);

  const sessions = tables.flatMap((table) =>
    db
      .prepare(
        `select id, directory, title, time_created
           from ${table}
          where directory = ?
            and time_created >= ?
          order by time_created desc`,
      )
      .all(repoRoot, since),
  );

  if (sessions.length === 0) {
    db.close();
    return [];
  }

  const sessionIds = new Set(sessions.map((session) => session.id));
  const rows = db
    .prepare(
      `select id, session_id, time_created, data
         from session_message
        where session_id in (${sessions.map(() => '?').join(',')})
          and data like '%"type":"tool"%'
        order by time_created desc
        limit 20000`,
    )
    .all(...sessionIds);

  const candidates = [];
  for (const row of rows) {
    let message;
    try {
      message = JSON.parse(row.data);
    } catch {
      continue;
    }
    const parts = Array.isArray(message?.content) ? message.content : [];
    for (const part of parts) {
      if (!part || part.type !== 'tool' || !part.state) continue;
      if (part.state.status !== 'completed') continue;
      const input = part.state.input ?? {};
      const name = part.name ?? 'unknown';
      const command = shellCommand(input);
      // Some sessions switch into a sibling checkout with `workdir`. Those
      // paths cannot be painted on this repo's city, so leave them out.
      if (typeof input.workdir === 'string' && input.workdir) {
        const relativeWorkdir = path.relative(
          repoRoot,
          path.resolve(input.workdir),
        );
        if (
          relativeWorkdir.startsWith('..') ||
          path.isAbsolute(relativeWorkdir)
        ) {
          continue;
        }
      }
      if (command) {
        if (command.length > MAX_COMMAND_CHARS) continue;
        if (command.includes('\n') || command.includes('<<')) continue;
        const first = command.split(/\s+/)[0] ?? '';
        if (SKIP_COMMAND_PREFIXES.some((prefix) => first.startsWith(prefix)))
          continue;
      }
      const key = dedupeKey({ name, input });
      candidates.push({
        key,
        category: commandCategory(name, input),
        toolCallId: part.id ?? `call-${row.id}`,
        messageId: row.id,
        sessionId: row.session_id,
        createdAt: row.time_created,
        name,
        kind: toolKind(name),
        input,
        content: part.state.content,
        command,
      });
    }
  }

  db.close();
  return candidates;
}

function pickCases(candidates, max) {
  const seen = new Set();
  const perCategory = new Map();
  const picked = [];

  // Seeds first, so `ls src/renderer` is in the set even when a busier
  // session has more recent listings.
  for (const seed of SEED_COMMANDS) {
    const candidate = candidates.find(
      (item) =>
        (item.name === 'shell' || item.name === 'bash') &&
        item.command === seed,
    );
    if (!candidate || seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    picked.push(candidate);
    perCategory.set(
      candidate.category,
      (perCategory.get(candidate.category) ?? 0) + 1,
    );
  }

  // Within a category prefer the most legible command rather than the most
  // recent: this is an audit surface, not a usage sample.
  const byCategory = new Map();
  for (const candidate of candidates) {
    if (seen.has(candidate.key)) continue;
    const group = byCategory.get(candidate.category) ?? [];
    group.push(candidate);
    byCategory.set(candidate.category, group);
  }
  for (const group of byCategory.values()) {
    group.sort((a, b) => {
      const lengthDelta = a.command.length - b.command.length;
      return lengthDelta !== 0 ? lengthDelta : b.createdAt - a.createdAt;
    });
  }

  // Round-robin so a single loud category (ls, grep) cannot crowd out reads,
  // writes, and the other tool shapes.
  const categories = [...byCategory.keys()].sort();
  let added = true;
  while (added && picked.length < max) {
    added = false;
    for (const category of categories) {
      if (picked.length >= max) break;
      const count = perCategory.get(category) ?? 0;
      if (count >= CASE_LIMIT_PER_CATEGORY) continue;
      const group = byCategory.get(category);
      const candidate = group?.shift();
      if (!candidate) continue;
      if (seen.has(candidate.key)) continue;
      seen.add(candidate.key);
      perCategory.set(category, count + 1);
      picked.push(candidate);
      added = true;
    }
  }

  // Stable, readable ordering: group by category, shortest first within group.
  return picked.sort((a, b) => {
    if (a.category === b.category) {
      const lengthDelta = a.command.length - b.command.length;
      return lengthDelta !== 0 ? lengthDelta : b.createdAt - a.createdAt;
    }
    return a.category.localeCompare(b.category);
  });
}

function relativePath(absolutePath) {
  const relative = path.relative(repoRoot, absolutePath);
  if (!relative) return '';
  return relative.split(path.sep).join('/');
}

function toItems(intents) {
  const items = [];
  const dropped = [];
  const seen = new Set();
  for (const intent of intents) {
    const relative = relativePath(intent.path);
    if (!relative) {
      dropped.push({ path: intent.path, reason: 'root-path' });
      continue;
    }
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      dropped.push({ path: intent.path, reason: 'outside-workspace' });
      continue;
    }
    if (seen.has(relative)) continue;
    seen.add(relative);
    items.push({
      path: relative,
      operation: intent.operation,
      kind: intent.kind ?? 'file',
    });
  }
  return { items, dropped };
}

function caseFromCandidate(candidate) {
  const processor = new OpenCodeACPEventProcessor();
  const update = {
    sessionUpdate: 'tool_call',
    toolCallId: candidate.toolCallId,
    name: candidate.name,
    kind: candidate.kind,
    status: 'completed',
    locations:
      candidate.kind === 'execute'
        ? [{ path: '' }]
        : candidate.input?.path
          ? [{ path: String(candidate.input.path) }]
          : [],
    rawInput: candidate.input,
    content: candidate.content,
  };

  let event;
  try {
    event = processor.normalize({
      sessionId: candidate.sessionId,
      workingDirectory: repoRoot,
      update,
      timestamp: candidate.createdAt,
    });
  } catch (error) {
    return {
      id: candidate.toolCallId,
      category: candidate.category,
      provenance: {
        sessionId: candidate.sessionId,
        messageId: candidate.messageId,
        callId: candidate.toolCallId,
        createdAt: new Date(candidate.createdAt).toISOString(),
      },
      tool: {
        name: candidate.name,
        kind: candidate.kind,
        status: 'completed',
        rawInput: candidate.input,
        content: truncate(contentText(candidate.content), MAX_CONTENT_CHARS),
      },
      intents: [],
      items: [],
      dropped: [],
      outcome: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const rawIntents = event.rawFileIntents ?? [];
  const intents = rawIntents.map((intent) => ({
    path: relativePath(intent.path) || intent.path,
    operation: intent.operation,
    kind: intent.kind ?? 'file',
    source: intent.source,
  }));
  const { items, dropped } = toItems(rawIntents);

  return {
    id: candidate.toolCallId,
    category: candidate.category,
    provenance: {
      sessionId: candidate.sessionId,
      messageId: candidate.messageId,
      callId: candidate.toolCallId,
      createdAt: new Date(candidate.createdAt).toISOString(),
    },
    tool: {
      name: candidate.name,
      kind: candidate.kind,
      status: 'completed',
      command: candidate.command || undefined,
      rawInput: candidate.input,
      // Recorded the way an ACP shell update reports it: one empty path.
      locations:
        candidate.kind === 'execute'
          ? [{ path: '' }]
          : candidate.input?.path
            ? [{ path: String(candidate.input.path) }]
            : [],
      content: truncate(contentText(candidate.content), MAX_CONTENT_CHARS),
    },
    intents,
    items,
    dropped,
    outcome: items.length > 0 ? 'highlighted' : 'no-file-paths',
  };
}

function cityFiles() {
  try {
    const output = execFileSync('git', ['ls-files'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function libraryVersion() {
  try {
    const entry = require.resolve('@principal-ai/agent-monitoring');
    const packageJson = path.join(path.dirname(entry), '..', 'package.json');
    return JSON.parse(readFileSync(packageJson, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

const candidates = readCandidates();
const picked = pickCases(candidates, limit);
const cases = picked.map(caseFromCandidate);
const files = cityFiles();

const corpus = {
  generatedAt: new Date().toISOString(),
  workspace: repoRoot,
  appCommit: gitHead(),
  agentMonitoringVersion: libraryVersion(),
  source: {
    kind: 'opencode-session-db',
    path: databasePath,
    sessionsScanned: new Set(cases.map((item) => item.provenance.sessionId))
      .size,
    toolCallsScanned: candidates.length,
    note: 'Telemetry spans do not carry the command text yet, so commands come from the OpenCode session DB. Intents are the OpenCodeACPEventProcessor output before PathNormalizationService; items apply the event server’s workspace-relative filter.',
  },
  cityFiles: files,
  cases,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(corpus, null, 2)}\n`);

const byCategory = new Map();
for (const item of cases) {
  byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
}
console.log(
  `Wrote ${cases.length} cases from ${candidates.length} completed tool calls (${files.length} city files) to ${path.relative(repoRoot, outputPath)}`,
);
for (const [category, count] of [...byCategory].sort()) {
  console.log(`  ${category}: ${count}`);
}
