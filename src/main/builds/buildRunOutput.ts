/** Utilities for returning a bounded, human-readable build terminal tail. */

export const DEFAULT_BUILD_OUTPUT_BYTES = 20 * 1024;
export const MAX_BUILD_OUTPUT_BYTES = 64 * 1024;

const ANSI_ESCAPE_SEQUENCE =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\)|[PX^_][\s\S]*?\u001B\\|[@-_])/g;
const OTHER_CONTROL_CHARACTERS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip terminal control sequences and redact exact secret values. */
export function sanitizeBuildOutput(
  raw: string,
  secretValues: string[] = [],
): string {
  let output = raw
    .replace(ANSI_ESCAPE_SEQUENCE, '')
    .replace(/\r\n?/g, '\n')
    .replace(OTHER_CONTROL_CHARACTERS, '');

  const uniqueSecrets = Array.from(new Set(secretValues.filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  );
  for (const secret of uniqueSecrets) {
    output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

/** Return the last `maxBytes` of UTF-8 text without starting mid-codepoint. */
export function tailBuildOutput(
  output: string,
  maxBytes: number,
): { output: string; bytesReturned: number; truncated: boolean } {
  const bytes = Buffer.from(output, 'utf8');
  if (bytes.length <= maxBytes) {
    return { output, bytesReturned: bytes.length, truncated: false };
  }

  let start = bytes.length - maxBytes;
  while (start < bytes.length && (bytes[start] & 0b1100_0000) === 0b1000_0000) {
    start += 1;
  }
  const tail = bytes.subarray(start).toString('utf8');
  return {
    output: tail,
    bytesReturned: bytes.length - start,
    truncated: true,
  };
}
