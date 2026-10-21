import type { SavedRequest } from '../../shared/requests/preparedRequest';
import type { HttpRequestTab } from '../events/portalTabs';

export function savedDefinition(tab: HttpRequestTab): SavedRequest {
  if (!tab.panelState.request) throw new Error('No request to save.');
  return {
    id: tab.savedRequestId,
    title: tab.label,
    request: tab.panelState.request,
    environment: tab.panelState.environment,
    repositoryPath: tab.repositoryPath,
    ...(tab.target && { target: tab.target }),
  };
}
