import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';
import { shellQuote } from './shellQuote';

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
