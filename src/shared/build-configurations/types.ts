/**
 * Build configuration types + validation (topic-1793592184227).
 *
 * A build configuration is agent-authored data: what command runs, which
 * single repo it needs, which revision to check out, and which secret env
 * names it requires. Secret *values* never appear here — only names.
 *
 * Dependency-free except for zod, so main, renderer, and CLI can share it.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent command allowlist — the single source of truth. Previously defined
// in src/main/processes/processRoutes.ts; moved here so build
// configurations reuse it instead of forking it.
// ---------------------------------------------------------------------------

/**
 * Binaries an agent may start. Narrow on purpose — this is the difference
 * between "run my dev server" and "run anything". Widen as needed.
 */
export const AGENT_COMMAND_ALLOWLIST: ReadonlySet<string> = new Set([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'npx',
  'node',
  'deno',
  'tsx',
  'tsc',
  'vite',
  'next',
  'astro',
  'nuxt',
  'storybook',
  'http-server',
  'vitest',
  'jest',
  'python',
  'python3',
  'uv',
  'go',
  'cargo',
  'make',
  'ruby',
  'bundle',
  'php',
  'composer',
  'dotnet',
  'docker',
]);

/** First whitespace-delimited token of a shell line, unquoted. */
export function commandBinaryOf(line: string): string {
  const token = line.trimStart().match(/^("[^"]*"|'[^']*'|\S+)/)?.[0] ?? '';
  const unquoted =
    token.length >= 2 &&
    ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")))
      ? token.slice(1, -1)
      : token;
  return unquoted.split('/').pop() ?? unquoted;
}

/** Whether the binary of a command line is on the agent allowlist. */
export function isAllowedCommandLine(line: string): boolean {
  return AGENT_COMMAND_ALLOWLIST.has(commandBinaryOf(line));
}

/** True when the line contains an unterminated single or double quote. */
export function hasUnterminatedQuote(line: string): boolean {
  let single = false;
  let double = false;
  for (const char of line) {
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single) double = !double;
  }
  return single || double;
}

// ---------------------------------------------------------------------------
// Path helpers — pure string logic, no node:path, so this stays usable in
// the renderer and Storybook.
// ---------------------------------------------------------------------------

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function resolveSegments(path: string): string[] {
  const out: string[] = [];
  for (const segment of normalizeSlashes(path).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      const popped = out.pop();
      if (popped === undefined) return [];
    } else {
      out.push(segment);
    }
  }
  return out;
}

/**
 * Whether `candidate` is inside `baseDir` (or equal to it), lexically
 * resolved so `..` escapes fail closed.
 */
export function isPathInsideBaseDir(
  candidate: string,
  baseDir: string,
): boolean {
  const base = resolveSegments(baseDir);
  const target = normalizeSlashes(candidate).split('/');
  // Re-resolve with .. handling against an absolute root.
  const resolved: string[] = [];
  for (const segment of target) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (resolved.length === 0) return false;
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }
  if (resolved.length < base.length) return false;
  return base.every((segment, index) => resolved[index] === segment);
}

/** Absolute POSIX path or Windows drive/`\\` path. */
export function isAbsolutePath(value: string): boolean {
  const normalized = normalizeSlashes(value);
  return (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith('//')
  );
}

/**
 * `cwd` is repo-relative: `.` or a subpath that stays inside the checkout.
 * Absolute paths and `..` escapes are rejected.
 */
export function isRepoRelativeCwd(cwd: string): boolean {
  if (cwd.trim() === '') return false;
  if (isAbsolutePath(cwd)) return false;
  const resolved = resolveSegments(cwd);
  // resolveSegments returns [] both for '.' and for escapes above root.
  // Distinguish: an escape attempt contains '..', '.' does not.
  if (resolved.length === 0) {
    return !cwd.split(/[/\\]/).includes('..');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const BUILD_CONFIG_ID_PATTERN = /^bc-[A-Za-z0-9_-]+$/;
export const BUILD_CONFIG_REPO_PATTERN =
  /^pkg:github\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const secretDeclSchema = z.object({
  /** Env var name — never a value. */
  env: z.string().regex(ENV_NAME_PATTERN, 'must be a valid env var name'),
  label: z.string().min(1).max(200),
  required: z.boolean(),
});

const secretConfirmationSchema = z.object({
  /** Fingerprint of the exact content the user confirmed. */
  fingerprint: z.string().min(1).max(500),
  /** Required secret env names covered by the confirmation. */
  envNames: z.array(z.string().regex(ENV_NAME_PATTERN)).max(50),
});

const checkoutSchema = z.object({
  /** Absolute clone path, or null for <baseDefaultDirectory>/<owner>/<repo>. */
  path: z.string().min(1).max(1000).nullable(),
  /** Branch, tag, or sha to build. */
  ref: z.string().min(1).max(200),
  /** Shallow-clone depth. */
  depth: z.number().int().min(1),
  /** What to do when a previous build checkout is still around. */
  reset: z.enum(['ff-only', 'clean', 'none']),
});

const commandSchema = z.object({
  /** Single shell line, typed into the terminal. No secret interpolation. */
  line: z.string().min(1).max(4000),
  /** Repo-relative working directory. */
  cwd: z.string().min(1).max(500),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60 * 1000),
});

export const buildConfigurationSchema = z
  .object({
    id: z.string().regex(BUILD_CONFIG_ID_PATTERN, 'must look like bc-...'),
    name: z.string().min(1).max(200),
    repo: z
      .string()
      .regex(BUILD_CONFIG_REPO_PATTERN, 'must be pkg:github/<owner>/<repo>'),
    checkout: checkoutSchema,
    command: commandSchema,
    secrets: z.array(secretDeclSchema).max(50),
    /**
     * The user's confirmation of the secret set, bound to exact content.
     * Null until confirmed in the app. Any material edit (repo, ref,
     * command line, secret names) must clear it.
     */
    secretConfirmation: secretConfirmationSchema.nullable(),
  })
  .superRefine((config, ctx) => {
    const line = config.command.line;
    if (/[\r\n]/.test(line)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command', 'line'],
        message: 'must be a single line',
      });
    }
    if (/\\\s*$/.test(line)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command', 'line'],
        message: 'must not end with a continuation backslash',
      });
    }
    if (hasUnterminatedQuote(line)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command', 'line'],
        message: 'contains an unterminated quote',
      });
    }
    const binary = commandBinaryOf(line);
    if (!isAllowedCommandLine(line)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command', 'line'],
        message: `binary "${binary}" is not on the agent allowlist`,
      });
    }
    if (!isRepoRelativeCwd(config.command.cwd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command', 'cwd'],
        message: 'must be a repo-relative path that stays inside the checkout',
      });
    }
    if (
      config.checkout.path !== null &&
      !isAbsolutePath(config.checkout.path)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkout', 'path'],
        message: 'must be an absolute path or null',
      });
    }
    const seen = new Set<string>();
    for (const secret of config.secrets) {
      if (seen.has(secret.env)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secrets'],
          message: `duplicate secret env name "${secret.env}"`,
        });
        break;
      }
      seen.add(secret.env);
    }
    if (config.secretConfirmation !== null) {
      const confirmed = config.secretConfirmation.envNames.slice().sort();
      const current = config.secrets
        .filter((secret) => secret.required)
        .map((secret) => secret.env)
        .sort();
      if (
        confirmed.length !== current.length ||
        confirmed.some((env, index) => env !== current[index])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secretConfirmation', 'envNames'],
          message: 'must cover exactly the required secret env names',
        });
      }
    }
  });

export type BuildSecretDecl = z.infer<typeof secretDeclSchema>;
export type BuildCheckout = z.infer<typeof checkoutSchema>;
export type BuildCommand = z.infer<typeof commandSchema>;
export type BuildConfiguration = z.infer<typeof buildConfigurationSchema>;

/** Lifecycle of a terminal-backed build run. */
export type BuildRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed-out'
  | 'cancelled';

/** A tracked build run. Records live in memory; tabs may outlive them. */
export interface BuildRunRecord {
  runId: string;
  configId: string;
  terminalSessionId: string;
  status: BuildRunStatus;
  exitCode?: number;
  startedAt: string;
  endedAt?: string;
}

/** List/index entry. Also used by the TIPC list route. */
export interface BuildConfigurationSummary {
  id: string;
  name: string;
  repo: string;
  confirmed: boolean;
  updatedAt: string;
}

/** Stored document: validated config plus store-managed timestamps. */
export type StoredBuildConfiguration = BuildConfiguration & {
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Validation entry point + confirmation helpers
// ---------------------------------------------------------------------------

export type BuildConfigurationValidation =
  | { ok: true; config: BuildConfiguration }
  | { ok: false; issues: string[] };

export interface BuildConfigurationValidateOptions {
  /**
   * When provided, a non-null checkout.path must live inside it.
   * Without it, only absoluteness is checked.
   */
  baseDefaultDirectory?: string;
}

/** Parse + validate unknown input into a BuildConfiguration. */
export function validateBuildConfiguration(
  value: unknown,
  options: BuildConfigurationValidateOptions = {},
): BuildConfigurationValidation {
  const parsed = buildConfigurationSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => {
        const at = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${at}${issue.message}`;
      }),
    };
  }
  const config = parsed.data;
  if (
    options.baseDefaultDirectory !== undefined &&
    config.checkout.path !== null &&
    !isPathInsideBaseDir(config.checkout.path, options.baseDefaultDirectory)
  ) {
    return {
      ok: false,
      issues: [
        'checkout.path: must be inside the base default directory or null',
      ],
    };
  }
  return { ok: true, config };
}

/**
 * Canonical fingerprint source for the secret confirmation: (repo, ref,
 * command line, sorted secret env names). The fingerprint is stored in the
 * confirmation itself (no hashing step); this keeps the confirmed content
 * stable and shared.
 */
export function confirmationFingerprintSource(
  config: BuildConfiguration,
): string {
  return JSON.stringify([
    config.repo,
    config.checkout.ref,
    config.command.line,
    config.secrets.map((secret) => secret.env).sort(),
  ]);
}

/** True when the config carries a confirmation matching its content. */
export function isConfirmationCurrent(config: BuildConfiguration): boolean {
  const confirmation = config.secretConfirmation;
  if (!confirmation) return false;
  return confirmation.fingerprint === confirmationFingerprintSource(config);
}

/** SecretsDomain repoId under which a config's secret values are granted. */
export function secretStoreRepoId(configId: string): string {
  return `build:${configId}`;
}

export interface BuildCheckoutRoots {
  buildsDirectory?: string | null;
  baseDefaultDirectory?: string | null;
}

/**
 * Resolve the directory a build runs in: an explicit checkout path wins,
 * otherwise <buildsDirectory>/<owner>/<repo>. Never falls back to the
 * general clone tree — an explicit builds directory is required. Null
 * means unresolvable: the caller must say "build dir not set" and refuse
 * to run rather than guess.
 */
export function resolveBuildCheckoutDir(args: {
  checkoutPath: string | null;
  cwd: string;
  repo: string;
  buildsDirectory?: string | null;
}): string | null {
  const root = resolveBuildRepoRoot(args);
  return root ? withCwd(root, args.cwd) : null;
}

/**
 * Repository root a build checks out into, before `command.cwd` is applied.
 * An explicit checkout path wins; otherwise
 * <buildsDirectory>/<owner>/<repo>. Null when neither resolves.
 */
export function resolveBuildRepoRoot(args: {
  checkoutPath: string | null;
  repo: string;
  buildsDirectory?: string | null;
}): string | null {
  if (args.checkoutPath) return args.checkoutPath.replace(/[/\\]+$/, '') || '/';
  if (!args.buildsDirectory) return null;
  const parsed = parsePurlSafe(args.repo);
  if (!parsed) return null;
  return joinSegments(args.buildsDirectory, parsed.owner, parsed.repo);
}

/** Clone URL for a supported build repo, or null. */
export function buildCheckoutCloneUrl(repo: string): string | null {
  const parsed = parsePurlSafe(repo);
  return parsed
    ? `https://github.com/${parsed.owner}/${parsed.repo}.git`
    : null;
}

function withCwd(dir: string, cwd: string): string {
  return cwd && cwd !== '.' ? joinSegments(dir, cwd) : dir;
}

function joinSegments(...segments: string[]): string {
  return segments
    .map((segment, index) => {
      if (index === 0) return segment.replace(/[/\\]+$/, '');
      return segment.replace(/^[/\\]+|[/\\]+$/g, '');
    })
    .filter((segment) => segment.length > 0)
    .join('/');
}

function parsePurlSafe(repo: string): { owner: string; repo: string } | null {
  const match = /^pkg:github\/([^/]+)\/([^/]+)$/.exec(repo.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
