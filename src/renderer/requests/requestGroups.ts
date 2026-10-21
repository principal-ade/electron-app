import type {
  SavedRequest,
  RequestTarget,
} from '../../shared/requests/preparedRequest';
import type { WorkspaceTab } from '../principal-window/PortalTabsContext';

export interface RequestGroupItem {
  id: string;
  savedRequestId: string;
  label: string;
  open: boolean;
}

export interface RequestIdentifierGroup {
  identifier?: string;
  requests: RequestGroupItem[];
}

export interface RequestPurlGroup {
  purl?: string;
  identifiers: RequestIdentifierGroup[];
}

/** Group exact, unverified strings. Open edits take precedence over remembered routes. */
export function buildRequestGroups(
  tabs: readonly WorkspaceTab[],
  rememberedRequests: readonly SavedRequest[],
): RequestPurlGroup[] {
  const entries = new Map<
    string,
    { item: RequestGroupItem; target?: RequestTarget }
  >();
  for (const tab of tabs) {
    if (tab.contentType !== 'http-request') continue;
    entries.set(tab.savedRequestId, {
      item: {
        id: tab.id,
        savedRequestId: tab.savedRequestId,
        label: tab.label,
        open: true,
      },
      target: tab.target,
    });
  }
  for (const request of rememberedRequests) {
    if (entries.has(request.id)) continue;
    entries.set(request.id, {
      item: {
        id: `http-request-${request.id}`,
        savedRequestId: request.id,
        label: request.title,
        open: false,
      },
      target: request.target,
    });
  }

  const groups = new Map<
    string | undefined,
    Map<string | undefined, RequestGroupItem[]>
  >();
  for (const { item, target } of entries.values()) {
    let identifiers = groups.get(target?.purl);
    if (!identifiers) {
      identifiers = new Map();
      groups.set(target?.purl, identifiers);
    }
    const requests = identifiers.get(target?.identifier) ?? [];
    requests.push(item);
    identifiers.set(target?.identifier, requests);
  }
  return [...groups]
    .map(([purl, identifiers]) => ({
      purl,
      identifiers: [...identifiers]
        .map(([identifier, requests]) => ({ identifier, requests }))
        .sort((a, b) => (a.identifier ?? '').localeCompare(b.identifier ?? '')),
    }))
    .sort((a, b) => {
      if (a.purl === undefined) return 1;
      if (b.purl === undefined) return -1;
      return a.purl.localeCompare(b.purl);
    });
}
