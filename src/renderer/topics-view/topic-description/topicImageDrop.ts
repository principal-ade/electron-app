/**
 * Capture + validation for screenshots dragged into a topic's description.
 *
 * This is the dependency-free half of the topic-images feature (see
 * docs/topic-images-feature.md): it turns an OS file drop into a validated,
 * content-hashed asset plus the `asset://<hash>` markdown reference that points
 * at it. It deliberately knows nothing about how the asset is persisted or
 * rendered — those seams (topic.assets storage, the themed-markdown
 * `transformImageUri` resolver) are wired separately once their upstream
 * releases land.
 *
 * This is a screenshot-sharing feature, not a general asset store: oversized or
 * non-image drops are rejected here, up front, so a topic only ever carries
 * small image bytes.
 */

/** Largest single image we accept. Screenshots compress well below this; the
 *  cap exists to keep topics.json (which is fully rewritten on every mutation)
 *  small. Must stay in sync with web-ade's POST validation. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Image MIME types we accept on drop. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * A validated, content-hashed image ready to attach to a topic. Mirrors the
 * planned `TopicAsset` shape (alexandria-core-library) minus the fields the
 * desktop drop path doesn't populate (`url`, `source`).
 */
export interface DroppedImageAsset {
  /** Content hash (SHA-256 hex) — free dedup + the stable `asset://` target. */
  id: string;
  /** e.g. "image/png". */
  mime: AllowedImageMime;
  /** Raw bytes, base64-encoded (no `data:` prefix). */
  data: string;
  /** Derived from the dropped file name; used as the markdown alt text. */
  alt: string;
}

export type ImageRejectReason = 'unsupported-type' | 'too-large';

export type PreparedImage =
  | { ok: true; asset: DroppedImageAsset }
  | { ok: false; fileName: string; reason: ImageRejectReason };

/** Pull image files out of a drag event's `dataTransfer.files`. Non-image
 *  files are ignored; the result is empty for panel/text drags. */
export function extractImageFiles(event: React.DragEvent): File[] {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return [];
  return Array.from(files).filter((f) => f.type.startsWith('image/'));
}

/**
 * Validate a dropped file against the mime allow-list and size cap, then read,
 * hash, and base64-encode its bytes. Resolves to a rejection (never throws on
 * a bad file) so the caller can surface per-file feedback.
 */
export async function prepareImageAsset(file: File): Promise<PreparedImage> {
  if (!isAllowedMime(file.type)) {
    return { ok: false, fileName: file.name, reason: 'unsupported-type' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, fileName: file.name, reason: 'too-large' };
  }
  const bytes = await file.arrayBuffer();
  const id = await sha256Hex(bytes);
  return {
    ok: true,
    asset: {
      id,
      mime: file.type,
      data: base64FromBytes(bytes),
      alt: altFromFileName(file.name),
    },
  };
}

/** The markdown reference inserted into the description for an attached asset. */
export function assetMarkdown(asset: DroppedImageAsset): string {
  return `![${asset.alt}](asset://${asset.id})`;
}

/** Human-readable reason for a rejected drop, for transient UI feedback. */
export function describeRejection(reason: ImageRejectReason): string {
  switch (reason) {
    case 'too-large':
      return `Image is too large (max ${formatBytes(MAX_IMAGE_BYTES)})`;
    case 'unsupported-type':
      return 'Unsupported image type (use PNG, JPEG, WebP, or GIF)';
  }
}

function isAllowedMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

function altFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || 'image';
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64FromBytes(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  // Chunk to keep String.fromCharCode's argument list within stack limits.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}
