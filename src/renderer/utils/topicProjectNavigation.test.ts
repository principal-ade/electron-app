import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { openTopicProject } from './topicProjectNavigation';

const purl = 'pkg:github/owner/app';
const local = { name: 'app', path: '/work/owner/app', purl } as AlexandriaEntry;

function navigate(
  repositories: AlexandriaEntry[],
  target?: 'profile' | 'terminal',
) {
  const emit = jest.fn();
  openTopicProject(
    { emit } as unknown as PanelEventEmitter,
    repositories,
    purl,
    target,
  );
  expect(emit).toHaveBeenCalledTimes(1);
  return emit.mock.calls[0][0];
}

test('normal clicks retain the local repository profile and aggregate clones', () => {
  const other = { ...local, path: '/other/app' } as AlexandriaEntry;
  const event = navigate([local, other]);
  expect(event).toMatchObject({
    type: 'repository:selected',
    payload: {
      localEntry: local,
      localClones: expect.arrayContaining([
        expect.objectContaining({ path: '/work/owner/app' }),
        expect.objectContaining({ path: '/other/app' }),
      ]),
    },
  });
});

test('alternate gestures request a fresh terminal tab in the matching clone', () => {
  const event = navigate(
    [
      {
        name: 'unrelated',
        path: '/work/other',
        purl: 'pkg:github/other/repo',
      } as AlexandriaEntry,
      local,
    ],
    'terminal',
  );
  expect(event).toMatchObject({
    type: 'terminal:new',
    source: 'topic-projects-rail',
    payload: { directory: '/work/owner/app', label: 'app' },
  });
  expect(event.payload).not.toHaveProperty('context');
  expect(event.payload).not.toHaveProperty('command');
});

test.each(['profile', 'terminal'] as const)(
  'remote-only repos retain explorer metadata for %s opens',
  (target) => {
    const event = navigate([], target);
    expect(event).toMatchObject({
      type: 'repository:selected',
      payload: { purl, github: { owner: 'owner', name: 'app' } },
    });
    expect(event.payload.localEntry).toBeUndefined();
  },
);

test('matches older registered clones by remote URL', () => {
  const event = navigate(
    [
      {
        name: 'app',
        path: '/work/legacy',
        remoteUrl: 'https://github.com/owner/app.git',
      } as AlexandriaEntry,
    ],
    'terminal',
  );
  expect(event).toMatchObject({
    type: 'terminal:new',
    payload: { directory: '/work/legacy' },
  });
});

test('does not invent a directory when a matching entry lacks a local path', () => {
  const event = navigate(
    [{ name: 'app', purl } as AlexandriaEntry],
    'terminal',
  );
  expect(event.type).toBe('repository:selected');
  expect(event.payload.localEntry).toBeUndefined();
});
