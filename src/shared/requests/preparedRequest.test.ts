/** @jest-environment node */
import { parsePreparedRequest, parseSavedRequest } from './preparedRequest';

const definition = {
  request: { http: { method: 'POST', url: '{{base}}/users/:id' } },
};

test('accepts a definition with explicit environment and editable parameters', () => {
  expect(
    parsePreparedRequest({
      ...definition,
      title: 'Create user',
      environment: { base: 'https://example.test' },
      request: {
        ...definition.request,
        headers: [{ name: 'x-key', value: '{{key}}', enabled: true }],
        params: [{ name: 'id', value: '42', enabled: true, type: 'path' }],
        body: { json: '{"name":"Ada"}' },
        auth: {
          mode: 'basic',
          basic: { username: '{{user}}', password: '{{pass}}' },
        },
      },
    }),
  ).toMatchObject({
    title: 'Create user',
    environment: { base: 'https://example.test' },
  });
});

test.each([
  { ...definition, send: true },
  { ...definition, response: { status: 200 } },
  { request: { ...definition.request, script: 'do something' } },
  { request: { http: { method: 'GET', url: 'file:///etc/passwd' } } },
  {
    request: {
      http: { method: 'GET\r\nHeader:', url: 'https://example.test' },
    },
  },
  { ...definition, environment: { bad: 42 } },
  { ...definition, repositoryPath: 'relative' },
  { ...definition, title: '' },
  {
    request: {
      ...definition.request,
      headers: [{ name: 'Key', value: 42, enabled: true }],
    },
  },
  {
    request: {
      ...definition.request,
      params: [{ name: 'x', value: 'y', enabled: true, type: 'other' }],
    },
  },
  { request: { ...definition.request, auth: { mode: 'oauth2' } } },
  {
    request: { ...definition.request, body: { json: '{}', text: 'ambiguous' } },
  },
])(
  'rejects malformed/unsupported definitions without echoing their values',
  (value) => {
    expect(() => parsePreparedRequest(value)).toThrow();
  },
);

test('bounds payloads and validates saved IDs', () => {
  expect(() =>
    parsePreparedRequest({
      ...definition,
      environment: { huge: 'x'.repeat(2_000_000) },
    }),
  ).toThrow('too large');
  expect(() => parseSavedRequest({ ...definition, id: '../file' })).toThrow(
    'id',
  );
  expect(parseSavedRequest({ ...definition, id: 'saved-1' })).toMatchObject({
    id: 'saved-1',
    title: 'HTTP request',
    environment: {},
  });
});

test('preserves trimmed opaque grouping independently of URL and originating repository', () => {
  const target = {
    purl: ' pkg:github/unregistered/backend ',
    identifier: ' Some C4 component ',
  };
  const parsed = parsePreparedRequest({
    ...definition,
    repositoryPath: '/work/frontend',
    target,
  });
  expect(parsed.target).toEqual({
    purl: 'pkg:github/unregistered/backend',
    identifier: 'Some C4 component',
  });
  expect(parsed.repositoryPath).toBe('/work/frontend');
  expect(parsed.request).toEqual(definition.request);
  expect(parseSavedRequest({ ...parsed, id: 'saved-target' }).target).toEqual(
    parsed.target,
  );
  // No PURL syntax, registration, or C4 existence check, only string shape/length.
  expect(
    parsePreparedRequest({
      ...definition,
      target: {
        purl: 'unregistered opaque scope',
        identifier: 'unverified name',
      },
    }).target?.purl,
  ).toBe('unregistered opaque scope');
});

test.each([
  null,
  [],
  'container:api',
  {},
  { purl: 'scope' },
  { identifier: 'api' },
  { purl: '', identifier: 'api' },
  { purl: 'scope', identifier: '  ' },
  { purl: 123, identifier: 'api' },
  { purl: 'scope', identifier: false },
  { purl: 'p'.repeat(1001), identifier: 'api' },
  { purl: 'scope', identifier: 'i'.repeat(201) },
  { purl: 'scope', identifier: 'api', verified: true },
])('rejects malformed grouping metadata: %p', (target) => {
  expect(() => parsePreparedRequest({ ...definition, target })).toThrow();
});

test('accepts target length boundaries and preserves legacy ungrouped definitions', () => {
  expect(
    parsePreparedRequest({
      ...definition,
      target: { purl: 'p'.repeat(1000), identifier: 'i'.repeat(200) },
    }).target,
  ).toBeDefined();
  expect(parsePreparedRequest(definition)).not.toHaveProperty('target');
});
