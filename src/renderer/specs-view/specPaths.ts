/**
 * OpenSpec path conventions.
 *
 * Recognizes the two spec-file layouts used by OpenSpec-style projects
 * (https://github.com/Fission-AI/OpenSpec):
 *
 * - stable capability specs:  `<repo>/openspec/specs/<capability>/spec.md`
 * - change deltas:            `<repo>/openspec/changes/<change>/specs/<capability>/spec.md`
 *
 * Anything else (e.g. a change's `proposal.md` / `tasks.md`) is not a spec
 * tab candidate and keeps routing to the generic markdown-doc tab.
 */

/** Which OpenSpec layout a spec file lives under. */
export type SpecKind = 'capability' | 'change';

export interface SpecPathInfo {
  kind: SpecKind;
  /** Capability id, e.g. `cli-list`. */
  capability: string;
  /** Change id for change deltas, e.g. `add-global-install-scope`. */
  change?: string;
  /** Repository root containing the `openspec/` tree, when inferable. */
  repositoryRoot?: string;
}

/** Normalize separators so Windows-style paths still parse. */
function normalize(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * True when `filePath` is an OpenSpec spec file (`…/openspec/…/spec.md`).
 * Matching is deliberately about the full segment sequence, not a substring
 * `includes`, so folders merely named `openspec` elsewhere don't match.
 */
export function isSpecFilePath(filePath: string): boolean {
  return parseSpecPath(filePath) !== null;
}

/**
 * Parse an absolute spec-file path into its OpenSpec identity, or `null` when
 * the path doesn't follow either layout.
 */
export function parseSpecPath(filePath: string): SpecPathInfo | null {
  const parts = normalize(filePath).split('/');
  const file = parts[parts.length - 1];
  if (file !== 'spec.md') return null;

  // `<root>/openspec/specs/<capability>/spec.md`
  const n = parts.length;
  if (n >= 4 && parts[n - 4] === 'openspec' && parts[n - 3] === 'specs') {
    const capability = parts[n - 2];
    if (!capability) return null;
    return {
      kind: 'capability',
      capability,
      repositoryRoot: parts.slice(0, n - 4).join('/') || undefined,
    };
  }

  // `<root>/openspec/changes/<change>/specs/<capability>/spec.md`
  if (
    n >= 6 &&
    parts[n - 6] === 'openspec' &&
    parts[n - 5] === 'changes' &&
    parts[n - 3] === 'specs'
  ) {
    const change = parts[n - 4];
    const capability = parts[n - 2];
    if (!change || !capability) return null;
    return {
      kind: 'change',
      change,
      capability,
      repositoryRoot: parts.slice(0, n - 6).join('/') || undefined,
    };
  }

  return null;
}

/**
 * Tab-strip label for a spec file. Capability specs use the capability id;
 * change deltas append the change so two deltas touching the same capability
 * don't collide as identical-looking tabs. The tab header shows the full
 * breadcrumb — this is just the compact strip label.
 */
export function specTabLabel(filePath: string): string {
  const info = parseSpecPath(filePath);
  if (!info) return filePath.split('/').pop() || 'Spec';
  return info.change ? `${info.capability} ∆ ${info.change}` : info.capability;
}
