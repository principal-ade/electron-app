import type { PreparedRequest } from './preparedRequest';
import { requestRouteKey } from './requestRoute';

const route: PreparedRequest = {
  title: 'List users',
  request: {
    http: { method: 'GET', url: 'https://api.test/users/:id?view=full' },
  },
  environment: {},
};

test('method, origin, literal path, and exact target pair define a route', () => {
  const key = requestRouteKey(route);
  for (const url of [
    'https://other.test/users/:id',
    'http://api.test/users/:id',
    'https://api.test:4000/users/:id',
    'https://api.test/users/42',
    'https://api.test/users/43',
    'https://api.test/users/:other',
  ]) {
    expect(
      requestRouteKey({ ...route, request: { http: { method: 'GET', url } } }),
    ).not.toBe(key);
  }
  expect(
    requestRouteKey({
      ...route,
      request: { http: { ...route.request.http, method: 'POST' } },
    }),
  ).not.toBe(key);
  expect(
    requestRouteKey({ ...route, target: { purl: 'repo', identifier: 'api' } }),
  ).not.toBe(key);
  expect(
    requestRouteKey({ ...route, target: { purl: 'a/b', identifier: 'c' } }),
  ).not.toBe(
    requestRouteKey({ ...route, target: { purl: 'a', identifier: 'b/c' } }),
  );
  expect(
    requestRouteKey({ ...route, target: { purl: 'Repo', identifier: 'api' } }),
  ).not.toBe(
    requestRouteKey({ ...route, target: { purl: 'repo', identifier: 'api' } }),
  );
});

test('queries, fragments, credentials, parameter values, bodies, and caller metadata do not multiply rows', () => {
  expect(
    requestRouteKey({
      ...route,
      title: 'Renamed',
      repositoryPath: '/caller/another',
      environment: { TOKEN: 'private' },
      request: {
        http: {
          method: 'get',
          url: 'https://user:password@API.test:443/users/:id?view=brief#section',
        },
        params: [{ name: 'id', value: '42', type: 'path', enabled: true }],
        headers: [{ name: 'Authorization', value: 'private', enabled: true }],
        body: { text: 'changed' },
      },
    }),
  ).toBe(requestRouteKey(route));
});

test('unresolved templates stay literal and never use environment values as identity', () => {
  const template = {
    ...route,
    request: { http: { method: 'GET', url: '{{base}}/users/{{id}}?q=one' } },
  };
  expect(requestRouteKey(template)).toBe(
    requestRouteKey({
      ...template,
      environment: { base: 'https://somewhere.test', id: '42' },
      request: { http: { method: 'GET', url: '{{base}}/users/{{id}}?q=two' } },
    }),
  );
  expect(requestRouteKey(template)).not.toBe(
    requestRouteKey({
      ...route,
      request: { http: { method: 'GET', url: '{{other}}/users/{{id}}' } },
    }),
  );
  expect(
    requestRouteKey({
      ...route,
      request: {
        http: { method: 'GET', url: 'https://api.test/users/{{id}}' },
      },
    }),
  ).not.toBe(
    requestRouteKey({
      ...route,
      request: {
        http: { method: 'GET', url: 'https://api.test/users/%7B%7Bid%7D%7D' },
      },
    }),
  );
});
