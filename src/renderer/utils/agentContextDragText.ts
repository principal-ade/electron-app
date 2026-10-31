import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';
import { shellQuote } from './shellQuote';

/** Drawings are local files rather than bridge-backed resources. */
export function drawingContextDragText(path: string, title: string): string {
  return `Use drawing "${title || 'Untitled drawing'}" as context — read the local Excalidraw file:\ncat ${shellQuote(path)}`;
}

/** Installed skills are local folders; point the agent at the SKILL.md. */
export function skillContextDragText(path: string, name: string): string {
  return `Use skill "${name || 'Untitled skill'}" as context — read its SKILL.md:\ncat ${shellQuote(path)}`;
}

/** Plain-text context prompt pasted by terminal drop targets. */
export function agentContextDragText(
  kind: 'topic' | 'subsystem model',
  id: string,
  title: string,
): string {
  const route = kind === 'topic' ? 'topics' : 'subsystem-models';
  const url = `${getPrincipalBridgeUrl()}/api/${route}/${encodeURIComponent(id)}`;
  return `Use ${kind} "${title || `Untitled ${kind}`}" (id: ${id}) as context — fetch via:\ncurl -s ${shellQuote(url)}`;
}
