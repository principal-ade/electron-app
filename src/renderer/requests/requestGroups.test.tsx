import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildRequestGroups } from './requestGroups';
import { RequestGroupList } from './RequestGroupList';
import type {
  SavedRequest,
  RequestTarget,
} from '../../shared/requests/preparedRequest';
import type { HttpRequestTab } from '../events/portalTabs';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: { body: 'sans-serif' },
      fontSizes: [10, 12, 14],
      space: [0, 4, 8],
    },
  }),
}));

function saved(id: string, target?: RequestTarget): SavedRequest {
  return {
    id,
    title: `Request ${id}`,
    request: {
      http: { method: 'GET', url: 'https://private.test?token=secret' },
    },
    environment: { TOKEN: 'secret' },
    repositoryPath: '/work/caller',
    ...(target && { target }),
  };
}

function tab(request: SavedRequest): HttpRequestTab {
  return {
    id: `http-request-${request.id}`,
    savedRequestId: request.id,
    sessionId: request.id,
    contentType: 'http-request',
    label: request.title,
    repositoryPath: request.repositoryPath,
    target: request.target,
    panelState: {
      request: request.request,
      requestId: request.id,
      environment: request.environment,
      environmentName: null,
      response: null,
      isSending: false,
      error: null,
    },
  };
}

test('groups exact PURL/identifier pairs, not origins or originating repositories', () => {
  const api = {
    purl: 'pkg:github/unregistered/backend',
    identifier: 'container:api',
  };
  const first = saved('one', api);
  const second = saved('two', { ...api, identifier: 'Request component' });
  const other = saved('three', {
    ...api,
    purl: 'pkg:github/unregistered/another',
  });
  const groups = buildRequestGroups(
    [tab(first)],
    [first, second, other, saved('legacy')],
  );
  expect(groups.map((group) => group.purl)).toEqual([
    other.target?.purl,
    api.purl,
    undefined,
  ]);
  const backend = groups.find((group) => group.purl === api.purl);
  if (!backend) throw new Error('Missing backend group.');
  expect(backend.identifiers).toHaveLength(2);
  expect(
    backend.identifiers.find((group) => group.identifier === api.identifier)
      ?.requests,
  ).toEqual([
    {
      id: 'http-request-one',
      savedRequestId: 'one',
      label: first.title,
      open: true,
    },
  ]);
  expect(
    groups.flatMap((group) =>
      group.identifiers.flatMap((identifier) => identifier.requests),
    ),
  ).toHaveLength(4);
  expect(JSON.stringify(groups)).not.toContain('secret');
  expect(JSON.stringify(groups)).not.toContain('/work/caller');
});

test('open unsaved grouping edits win, and closing uses the last explicitly saved grouping', () => {
  const original = saved('one', { purl: 'scope', identifier: 'old' });
  const edited = {
    ...original,
    title: 'Edited',
    target: { purl: 'another scope', identifier: 'new' },
  };
  expect(buildRequestGroups([tab(edited)], [original])).toMatchObject([
    {
      purl: 'another scope',
      identifiers: [
        { identifier: 'new', requests: [{ label: 'Edited', open: true }] },
      ],
    },
  ]);
  expect(
    buildRequestGroups([tab({ ...edited, target: undefined })], [original])[0]
      .purl,
  ).toBeUndefined();
  expect(buildRequestGroups([], [original])).toMatchObject([
    {
      purl: 'scope',
      identifiers: [{ identifier: 'old', requests: [{ open: false }] }],
    },
  ]);
});

test('opaque keys cannot collide through delimiters or special object-property names', () => {
  const definitions = [
    saved('one', { purl: 'a/b', identifier: 'c' }),
    saved('two', { purl: 'a', identifier: 'b/c' }),
    saved('three', { purl: '__proto__', identifier: 'constructor' }),
    saved('four', { purl: 'A', identifier: 'b/c' }),
    saved('five', { purl: 'a', identifier: 'B/C' }),
  ];
  const groups = buildRequestGroups([], definitions);
  expect(groups).toHaveLength(4);
  expect(groups.find((group) => group.purl === 'a')?.identifiers).toHaveLength(
    2,
  );
});

test('renders PURL then identifier groups and Ungrouped, with activation delegated to the host', () => {
  const target = {
    purl: 'pkg:github/unknown/backend',
    identifier: 'Some component name',
  };
  const first = saved('one', target);
  const legacy = saved('legacy');
  const activate = jest.fn();
  render(
    <RequestGroupList
      groups={buildRequestGroups([tab(first)], [first, legacy])}
      renderRequest={(request) => (
        <button
          key={request.id}
          type="button"
          onClick={() => activate(request.id)}
        >
          {request.label}
        </button>
      )}
    />,
  );
  const purl = screen.getByText(target.purl).closest('details');
  const identifier = screen.getByText(target.identifier).closest('details');
  if (!purl || !identifier) throw new Error('Missing request group details.');
  expect(purl.contains(identifier)).toBe(true);
  expect(identifier.contains(screen.getByText(first.title))).toBe(true);
  const ungrouped = screen.getByText('Ungrouped').closest('details');
  expect(ungrouped?.contains(screen.getByText(legacy.title))).toBe(true);
  expect(activate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(first.title));
  fireEvent.click(screen.getByText(legacy.title));
  expect(activate.mock.calls).toEqual([
    ['http-request-one'],
    ['http-request-legacy'],
  ]);
});

test('does not render an empty request section', () => {
  const { container } = render(
    <RequestGroupList groups={[]} renderRequest={() => null} />,
  );
  expect(container.firstChild).toBeNull();
});

test('sidebar groups omit the duplicate heading while Home keeps its section heading', () => {
  const groups = buildRequestGroups([], [saved('one')]);
  const renderRequest = (request: { id: string; label: string }) => (
    <button key={request.id}>{request.label}</button>
  );
  const { rerender } = render(
    <RequestGroupList groups={groups} renderRequest={renderRequest} />,
  );
  expect(screen.getByRole('heading', { name: 'Requests' })).toBeTruthy();
  rerender(
    <RequestGroupList
      groups={groups}
      renderRequest={renderRequest}
      variant="sidebar"
    />,
  );
  expect(screen.queryByRole('heading', { name: 'Requests' })).toBeNull();
  expect(screen.getByRole('region', { name: 'Requests' })).toBeTruthy();
  expect(screen.getByText('Ungrouped').style.fontFamily).toBe('sans-serif');
  expect(screen.getByRole('button', { name: 'Request one' })).toBeTruthy();
});
