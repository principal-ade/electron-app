import { toDetachableTabDescriptor } from './detachedTabDescriptor';
import type { WorkspaceTab } from '../principal-window/PortalTabsContext';

describe('toDetachableTabDescriptor', () => {
  it('maps a local topic tab', () => {
    expect(
      toDetachableTabDescriptor({
        id: 'local-topic-t1',
        label: 'A topic',
        contentType: 'local-topic',
        closable: true,
        topicId: 't1',
        title: 'A topic',
      } as WorkspaceTab),
    ).toEqual({
      kind: 'local-topic',
      tabId: 'local-topic-t1',
      label: 'A topic',
      topicId: 't1',
      title: 'A topic',
    });
  });

  it('maps a subsystem model tab', () => {
    expect(
      toDetachableTabDescriptor({
        id: 'subsystem-model-m1',
        label: 'Model',
        contentType: 'subsystem-model',
        closable: true,
        modelId: 'm1',
      } as WorkspaceTab),
    ).toEqual({
      kind: 'subsystem-model',
      tabId: 'subsystem-model-m1',
      label: 'Model',
      modelId: 'm1',
    });
  });

  it('returns null for tabs that carry live state', () => {
    expect(
      toDetachableTabDescriptor({
        id: 'terminal-1',
        label: 'Terminal',
        contentType: 'terminal',
        closable: true,
      } as WorkspaceTab),
    ).toBeNull();
    expect(toDetachableTabDescriptor(undefined)).toBeNull();
    expect(toDetachableTabDescriptor(null)).toBeNull();
  });
});
