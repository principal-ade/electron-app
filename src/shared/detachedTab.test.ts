/** @jest-environment node */

import { isDetachableTabDescriptor } from './detachedTab';

describe('isDetachableTabDescriptor', () => {
  it('accepts a C4 sketch only with its reload key', () => {
    const descriptor = {
      kind: 'c4-sketch',
      tabId: 'c4-sketch-c4s-123-abc',
      label: 'Architecture',
    };
    expect(isDetachableTabDescriptor(descriptor)).toBe(false);
    expect(
      isDetachableTabDescriptor({ ...descriptor, sketchId: 'c4s-123-abc' }),
    ).toBe(true);
    expect(isDetachableTabDescriptor({ ...descriptor, sketchId: 42 })).toBe(
      false,
    );
    expect(
      isDetachableTabDescriptor({ ...descriptor, sketchId: 'x'.repeat(513) }),
    ).toBe(false);
  });

  it('accepts a local topic with its reload key', () => {
    expect(
      isDetachableTabDescriptor({
        kind: 'local-topic',
        tabId: 'local-topic-123',
        label: 'My topic',
        topicId: '123',
        title: 'My topic',
      }),
    ).toBe(true);
  });

  it('accepts a subsystem model with its reload key', () => {
    expect(
      isDetachableTabDescriptor({
        kind: 'subsystem-model',
        tabId: 'subsystem-model-model-1',
        label: 'Model',
        modelId: 'model-1',
      }),
    ).toBe(true);
  });

  it.each([
    null,
    undefined,
    'local-topic',
    [],
    { kind: 'terminal', tabId: 't1', label: 'Terminal' },
    { kind: 'local-topic', tabId: 'local-topic-1', label: 'No id' },
    {
      kind: 'subsystem-model',
      tabId: 'subsystem-model-1',
      label: 'No model',
    },
    { kind: 'local-topic', tabId: '', label: 'x', topicId: '1' },
    { kind: 'local-topic', tabId: 't', label: '', topicId: '1' },
    { kind: 'local-topic', tabId: 't', label: 42, topicId: '1' },
  ])('rejects malformed descriptors (%#)', (value) => {
    expect(isDetachableTabDescriptor(value)).toBe(false);
  });

  it('rejects oversized strings', () => {
    expect(
      isDetachableTabDescriptor({
        kind: 'local-topic',
        tabId: 'local-topic-1',
        label: 'x'.repeat(513),
        topicId: '1',
      }),
    ).toBe(false);
  });
});
