/**
 * Prompt content assembly for ACP sessions.
 *
 * ACP agents own their accumulated conversation, so the client can only control
 * the `session/prompt` payload. Session artifacts are therefore re-sent as a
 * compact text preamble plus `resource_link` blocks on every prompt. Staged
 * artifacts are a one-shot emphasis for the next message.
 *
 * `resource_link` is baseline-supported by ACP. Whether an agent dereferences a
 * link automatically varies, so the text preamble carries the same URLs/paths
 * as a reliable fallback. Embedded `resource` blocks are intentionally not sent
 * yet; they are optional (`promptCapabilities.embeddedContext`) and need a size
 * policy before we copy artifact content into every prompt.
 */
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import type { ContentBlock } from '@agentclientprotocol/sdk';
import type { AcpArtifactAssociation } from '../../shared/main-process-api-interfaces/AcpAPI';
import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';

function artifactKindLabel(kind: AcpArtifactAssociation['kind']): string {
  switch (kind) {
    case 'topic':
      return 'topic';
    case 'subsystem-model':
      return 'subsystem model';
    case 'drawing':
      return 'drawing';
  }
}

function artifactTitle(artifact: AcpArtifactAssociation): string {
  return (
    artifact.title?.trim() ||
    `${artifactKindLabel(artifact.kind)} ${artifact.id}`
  );
}

export function artifactUri(artifact: AcpArtifactAssociation): string {
  switch (artifact.kind) {
    case 'topic':
      return `${getPrincipalBridgeUrl()}/api/topics/${encodeURIComponent(artifact.id)}`;
    case 'subsystem-model':
      return `${getPrincipalBridgeUrl()}/api/subsystem-models/${encodeURIComponent(artifact.id)}`;
    case 'drawing':
      return pathToFileURL(
        path.join(
          os.homedir(),
          '.alexandria',
          'drawings',
          `${artifact.id}.excalidraw`,
        ),
      ).href;
  }
}

function artifactLine(artifact: AcpArtifactAssociation): string {
  const uri = artifactUri(artifact);
  const action = artifact.kind === 'drawing' ? 'read' : 'fetch';
  return `- ${artifactKindLabel(artifact.kind)} "${artifactTitle(artifact)}" (id: ${artifact.id}) — ${action} ${uri}`;
}

export function formatAssociatedArtifacts(
  artifacts: AcpArtifactAssociation[],
): string {
  return [
    'Associated artifacts for this session:',
    ...artifacts.map(artifactLine),
  ].join('\n');
}

export function formatStagedArtifacts(
  artifacts: AcpArtifactAssociation[],
): string {
  return [
    'The user attached these artifacts to this message:',
    ...artifacts.map(artifactLine),
  ].join('\n');
}

function artifactKeys(
  artifacts: AcpArtifactAssociation[],
): Map<string, AcpArtifactAssociation> {
  const byKey = new Map<string, AcpArtifactAssociation>();
  for (const artifact of artifacts) {
    byKey.set(`${artifact.kind}:${artifact.id}`, artifact);
  }
  return byKey;
}

export interface BuildAcpPromptContentInput {
  text: string;
  artifacts: AcpArtifactAssociation[];
  stagedArtifacts?: AcpArtifactAssociation[];
}

/**
 * Build the ordered content blocks for `session/prompt`:
 * associated-docs preamble, links, staged-message emphasis, then user text.
 */
export function buildAcpPromptContent({
  text,
  artifacts,
  stagedArtifacts = [],
}: BuildAcpPromptContentInput): ContentBlock[] {
  const content: ContentBlock[] = [];

  if (artifacts.length > 0) {
    content.push({ type: 'text', text: formatAssociatedArtifacts(artifacts) });
  }

  const linkArtifacts = [
    ...artifactKeys([...artifacts, ...stagedArtifacts]).values(),
  ];
  for (const artifact of linkArtifacts) {
    content.push({
      type: 'resource_link',
      name: artifactTitle(artifact),
      title: artifactTitle(artifact),
      uri: artifactUri(artifact),
      mimeType: 'application/json',
    });
  }

  if (stagedArtifacts.length > 0) {
    content.push({
      type: 'text',
      text: formatStagedArtifacts(stagedArtifacts),
    });
  }

  content.push({ type: 'text', text });
  return content;
}
