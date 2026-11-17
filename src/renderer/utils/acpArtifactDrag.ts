/**
 * Typed drag payload for dragging workspace artifacts into an ACP session.
 *
 * Side panels keep setting `text/plain` so terminal drop targets still work.
 * The ACP panel reads this typed payload to distinguish an artifact drop from
 * arbitrary text or OS files.
 */
import type { AcpArtifactAssociation } from '../../shared/main-process-api-interfaces/AcpAPI';

export const ACP_ARTIFACT_MIME = 'application/x-principal-acp-artifact';

export function acpArtifactKey(artifact: AcpArtifactAssociation): string {
  return `${artifact.kind}:${artifact.id}`;
}

export function dedupeAcpArtifacts(
  artifacts: AcpArtifactAssociation[],
): AcpArtifactAssociation[] {
  const byKey = new Map<string, AcpArtifactAssociation>();
  for (const artifact of artifacts) {
    byKey.set(acpArtifactKey(artifact), artifact);
  }
  return [...byKey.values()];
}

function isAcpArtifactKind(
  value: unknown,
): value is AcpArtifactAssociation['kind'] {
  return (
    value === 'topic' || value === 'subsystem-model' || value === 'drawing'
  );
}

export function setAcpArtifactDragData(
  dataTransfer: DataTransfer | null,
  artifact: AcpArtifactAssociation,
): void {
  dataTransfer?.setData(ACP_ARTIFACT_MIME, JSON.stringify(artifact));
}

export function hasAcpArtifactDrag(dataTransfer: DataTransfer | null): boolean {
  return Array.from(dataTransfer?.types ?? []).includes(ACP_ARTIFACT_MIME);
}

export function readAcpArtifactDrag(
  dataTransfer: DataTransfer | null,
): AcpArtifactAssociation | null {
  const raw = dataTransfer?.getData(ACP_ARTIFACT_MIME);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isAcpArtifactKind(record.kind)) return null;
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : undefined;
  return {
    kind: record.kind,
    id: record.id,
    ...(title ? { title } : {}),
  };
}
