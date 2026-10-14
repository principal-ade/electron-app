/**
 * Program Status Protocol (OSC 7501) — parser + record registry.
 *
 * A program emits `ESC ] 7501 ; pairs ST` to report what it is doing; the
 * terminal owns the resulting records. This module is intentionally
 * dependency-free (no Node/Electron globals) so it can be unit-tested and
 * type-imported from any process.
 *
 * Spec: https://www.superlogical.com/rex/docs/build/program-status
 *
 * Wire form:
 *   OSC 7501 ; state=blocked:kind=permission:app=terraform:msg=<base64> ST
 *   OSC 7501 ; ? ST                      feature detection (query)
 *
 * Pairs are separated by `:` (not `;`); the `;` separates the OSC code from the
 * pairs. Values never contain `:` or `;`.
 */

// =============================================================================
// Types
// =============================================================================

export type ProgramStatusState =
  | 'idle'
  | 'working'
  | 'done'
  | 'blocked'
  | 'error'
  | 'clear';

export type ProgramStatusKind = 'permission' | 'question' | 'auth';

/**
 * A record as stored by the terminal. `id` absent means the root record.
 * Note: this is the *storage* shape; `clear` is handled by the registry and is
 * never stored.
 */
export interface ProgramStatusRecord {
  id?: string;
  state: Exclude<ProgramStatusState, 'clear'>;
  kind?: ProgramStatusKind;
  progress?: number;
  app?: string;
  /** Decoded (untrusted) one-line message. */
  msg?: string;
  /** Decoded (untrusted) short label. */
  title?: string;
}

/** States a terminal accepts (excludes `clear`). */
export const PROGRAM_STATUS_STATES: ReadonlyArray<
  Exclude<ProgramStatusState, 'clear'>
> = ['idle', 'working', 'done', 'blocked', 'error'];

/** Kinds a terminal accepts. */
export const PROGRAM_STATUS_KINDS: ReadonlyArray<ProgramStatusKind> = [
  'permission',
  'question',
  'auth',
];

/**
 * Reply to `OSC 7501 ; ? ST`. Contains nothing from any report (see Security).
 */
export const PROGRAM_STATUS_FEATURE_DETECTION_REPLY =
  '\x1b]7501;?:states=idle,working,done,blocked,error:kinds=permission,question,auth\x1b\\';

// =============================================================================
// Limits (spec "Limits" table). A report breaking any limit is discarded whole.
// =============================================================================

const LIMIT = {
  OSC: 4096,
  KEY: 16,
  MSG_ENCODED: 2732,
  MSG_DECODED: 2048,
  TITLE_ENCODED: 256,
  TITLE_DECODED: 192,
  APP: 32,
  ID_TOTAL: 128,
  ID_SEGMENT: 32,
  ID_LEVELS: 8,
  RECORDS: 256,
} as const;

// =============================================================================
// Byte-level OSC scanner (chunk-safe)
// =============================================================================

export interface OscSequence {
  /** Numeric OSC code, e.g. `7501` or `133`. */
  code: string;
  /** Everything after the first `;`, e.g. `state=working` or `?` or `A`. */
  payload: string;
}

/**
 * Extracts OSC sequences from a stream of PTY output, tolerating sequences that
 * are split across chunks and discarding oversized partial sequences.
 */
export class OscScanner {
  private pending = '';

  push(chunk: string): OscSequence[] {
    if (chunk.length === 0) return [];
    this.pending += chunk;

    const buf = this.pending;
    const out: OscSequence[] = [];
    let cursor = 0;

    for (;;) {
      const start = buf.indexOf('\x1b]', cursor);
      if (start === -1) {
        // Preserve a trailing lone ESC (may be the start of `ESC ]`).
        cursor = buf.endsWith('\x1b') ? buf.length - 1 : buf.length;
        break;
      }

      // Find the terminator: BEL (0x07) or ST (ESC \).
      let term = -1;
      let termLen = 0;
      for (let i = start + 2; i < buf.length; i++) {
        const c = buf.charCodeAt(i);
        if (c === 0x07) {
          term = i;
          termLen = 1;
          break;
        }
        if (c === 0x1b && buf.charCodeAt(i + 1) === 0x5c) {
          term = i;
          termLen = 2;
          break;
        }
      }

      if (term === -1) {
        // Incomplete sequence.
        if (buf.length - start > LIMIT.OSC) {
          // Too large to ever be valid — drop the introducer and keep scanning.
          cursor = start + 2;
          continue;
        }
        cursor = start;
        break;
      }

      const raw = buf.slice(start + 2, term);
      if (raw.length <= LIMIT.OSC) {
        const semi = raw.indexOf(';');
        out.push({
          code: semi === -1 ? raw : raw.slice(0, semi),
          payload: semi === -1 ? '' : raw.slice(semi + 1),
        });
      }
      cursor = term + termLen;
    }

    this.pending = buf.slice(cursor);
    return out;
  }
}

// =============================================================================
// Report parsing
// =============================================================================

/** `clear` is a directive, not a stored state. */
export interface ProgramStatusClear {
  id?: string;
  state: 'clear';
}

/** `?` means feature detection; a record/directive means a report; null means ignore. */
export type ParsedProgramStatus =
  | ProgramStatusRecord
  | ProgramStatusClear
  | 'query'
  | null;

const VALUE_RE = /^[A-Za-z0-9_.,+/=-]*$/;
const KEY_RE = /^[a-z]+$/;
const APP_RE = /^[A-Za-z0-9_.+-]{1,32}$/;
const ID_SEGMENT_RE = /^[A-Za-z0-9_.+-]{1,32}$/;

const B64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): number[] | null {
  const s = input.replace(/=+$/, '');
  if (s.length % 4 === 1) return null;
  for (let i = 0; i < s.length; i++) {
    if (B64_ALPHABET.indexOf(s[i]) === -1) return null;
  }
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < s.length; i++) {
    value = (value << 6) | B64_ALPHABET.indexOf(s[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return bytes;
}

function isControlCodePoint(cp: number): boolean {
  return (
    (cp >= 0x00 && cp <= 0x1f) ||
    cp === 0x7f ||
    (cp >= 0x80 && cp <= 0x9f)
  );
}

/** Decode base64 → UTF-8 string, rejecting control chars. Returns null on any failure. */
function decodeText(encoded: string, encodedLimit: number, decodedLimit: number): string | null {
  if (encoded.length > encodedLimit) return null;
  const bytes = base64Decode(encoded);
  if (bytes === null) return null;

  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i];
    let cp: number;
    let size: number;
    if (b0 < 0x80) {
      cp = b0;
      size = 1;
    } else if (b0 >= 0xc2 && b0 < 0xe0) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      size = 2;
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      size = 3;
    } else if (b0 >= 0xf0 && b0 < 0xf5) {
      cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      size = 4;
    } else {
      return null;
    }
    if (i + size > bytes.length || cp > 0x10ffff) return null;
    if (isControlCodePoint(cp)) return null;
    out += String.fromCodePoint(cp);
    i += size;
  }

  if (out.length > decodedLimit) return null;
  return out;
}

function parseId(id: string): string | null {
  if (id.length === 0 || id.length > LIMIT.ID_TOTAL) return null;
  const segments = id.split('/');
  if (segments.length > LIMIT.ID_LEVELS) return null;
  for (const seg of segments) {
    if (!ID_SEGMENT_RE.test(seg)) return null;
  }
  return id;
}

/**
 * Parse the `payload` (text after the first `;`) of an OSC 7501 sequence.
 * Returns `'query'` for feature detection, a record for a valid report, or
 * `null` when the report must be ignored/discarded.
 */
export function parseProgramStatusPayload(payload: string): ParsedProgramStatus {
  const trimmed = payload.trim();
  if (trimmed === '?') return 'query';
  if (trimmed.length === 0) return null;

  const pairs = new Map<string, string>();
  for (const rawPair of trimmed.split(':')) {
    const eq = rawPair.indexOf('=');
    if (eq === -1) continue; // malformed pair — skip
    const key = rawPair.slice(0, eq).trim();
    const value = rawPair.slice(eq + 1).trim();
    if (key.length === 0) continue; // malformed pair — skip
    if (key.length > LIMIT.KEY) return null; // limit exceeded — discard whole
    if (!KEY_RE.test(key)) continue; // malformed key — skip
    if (!VALUE_RE.test(value)) continue; // malformed value — skip
    pairs.set(key, value); // last wins
  }

  const state = pairs.get('state');
  if (
    state === undefined ||
    (state !== 'clear' &&
      !PROGRAM_STATUS_STATES.includes(state as Exclude<ProgramStatusState, 'clear'>))
  ) {
    return null; // missing/unknown state — ignore report
  }

  let id: string | undefined;
  if (pairs.has('id')) {
    const parsed = parseId(pairs.get('id') as string);
    if (parsed === null) return null; // malformed id — ignore report
    id = parsed;
  }

  if (state === 'clear') {
    return { id, state: 'clear' };
  }

  const record: ProgramStatusRecord = {
    state: state as Exclude<ProgramStatusState, 'clear'>,
  };
  if (id !== undefined) record.id = id;

  // kind — only with blocked
  if (state === 'blocked' && pairs.has('kind')) {
    const kind = pairs.get('kind') as string;
    if (PROGRAM_STATUS_KINDS.includes(kind as ProgramStatusKind)) {
      record.kind = kind as ProgramStatusKind;
    }
  }

  // progress — only with working/blocked
  if ((state === 'working' || state === 'blocked') && pairs.has('progress')) {
    const raw = pairs.get('progress') as string;
    if (/^\d{1,3}$/.test(raw)) {
      const n = Number(raw);
      if (n >= 0 && n <= 100) record.progress = n;
    }
  }

  // app
  if (pairs.has('app')) {
    const app = pairs.get('app') as string;
    if (APP_RE.test(app)) record.app = app;
  }

  // msg / title — discard whole report on any failure
  if (pairs.has('msg')) {
    const decoded = decodeText(pairs.get('msg') as string, LIMIT.MSG_ENCODED, LIMIT.MSG_DECODED);
    if (decoded === null) return null;
    record.msg = decoded;
  }
  if (pairs.has('title')) {
    const decoded = decodeText(
      pairs.get('title') as string,
      LIMIT.TITLE_ENCODED,
      LIMIT.TITLE_DECODED,
    );
    if (decoded === null) return null;
    record.title = decoded;
  }

  return record;
}

// =============================================================================
// Record registry
// =============================================================================

const TRANSIENT_STATES: ReadonlySet<ProgramStatusState> = new Set([
  'working',
  'blocked',
  'idle',
]);

/**
 * Holds the set of records for one terminal. Each report replaces its record
 * completely; `clear` removes a record and its descendants (or everything).
 */
export class ProgramStatusRegistry {
  // Map preserves insertion order; re-inserting on update keeps an LRU order.
  private records = new Map<string, ProgramStatusRecord>();

  /** Apply a parsed report. Returns true if the record set changed. */
  applyReport(report: ProgramStatusRecord | ProgramStatusClear): boolean {
    if (report.state === 'clear') {
      return report.id !== undefined
        ? this.clearRecord(report.id)
        : this.clearAll();
    }

    const key = report.id ?? '';
    // Move to most-recently-updated position.
    this.records.delete(key);
    this.records.set(key, report);

    // Enforce the per-terminal record cap by evicting the least-recently updated.
    while (this.records.size > LIMIT.RECORDS) {
      const oldest = this.records.keys().next().value;
      if (oldest === undefined) break;
      this.records.delete(oldest);
    }
    return true;
  }

  /** Remove a record and every record beneath it. */
  clearRecord(id: string): boolean {
    let changed = false;
    for (const key of Array.from(this.records.keys())) {
      if (key === id || key.startsWith(`${id}/`)) {
        this.records.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  clearAll(): boolean {
    if (this.records.size === 0) return false;
    this.records.clear();
    return true;
  }

  /**
   * Drop records whose lifetime ends at process exit or a new shell prompt
   * (OSC 133 `A`): `working`/`blocked`/`idle`. `done`/`error` survive.
   */
  dropTransient(): boolean {
    let changed = false;
    for (const [key, record] of Array.from(this.records.entries())) {
      if (TRANSIENT_STATES.has(record.state)) {
        this.records.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  /** Current records, with `app` resolved from the nearest ancestor. */
  list(): ProgramStatusRecord[] {
    return Array.from(this.records.values()).map((record) => {
      if (record.app !== undefined || record.id === undefined) return record;
      const inherited = this.resolveInheritedApp(record.id);
      return inherited === undefined ? record : { ...record, app: inherited };
    });
  }

  private resolveInheritedApp(id: string): string | undefined {
    const segments = id.split('/');
    for (let i = segments.length - 1; i >= 0; i--) {
      const ancestor = segments.slice(0, i).join('/');
      const record = this.records.get(ancestor);
      if (record?.app !== undefined) return record.app;
    }
    return undefined;
  }

  get size(): number {
    return this.records.size;
  }
}
