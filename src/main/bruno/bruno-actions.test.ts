/** @jest-environment node */
import { sendBrunoRequest } from './bruno-actions';

jest.mock('@usebruno/requests', () => ({ makeAxiosInstance: jest.fn() }));
const { makeAxiosInstance } = jest.requireMock<{
  makeAxiosInstance: jest.Mock;
}>('@usebruno/requests');
const execute = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  makeAxiosInstance.mockReturnValue({ request: execute });
  execute.mockResolvedValue({
    status: 400,
    statusText: 'Bad Request',
    headers: { 'content-type': 'application/json' },
    data: { error: 'expected' },
  });
});

test('explicit send interpolates literal variables, encodes params/auth, and returns non-2xx bodies', async () => {
  const response = await sendBrunoRequest(
    {
      http: { method: 'POST', url: 'https://example.test/users/:id/:identity' },
      params: [
        { name: 'id', value: '{{id}}', enabled: true, type: 'path' },
        { name: 'q', value: '{{key.with.dot}}', enabled: true, type: 'query' },
        { name: 'ignore', value: 'no', enabled: false, type: 'query' },
      ],
      headers: [{ name: 'X-Key', value: '{{key.with.dot}}', enabled: true }],
      body: { json: '{"value":"{{key.with.dot}}"}' },
      auth: {
        mode: 'basic',
        basic: { username: '{{user}}', password: '{{password}}' },
      },
    },
    { id: 'a/b', 'key.with.dot': '$&', user: 'name', password: 'value' },
  );
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://example.test/users/a%2Fb/:identity?q=%24%26',
      method: 'POST',
      data: '{"value":"$&"}',
      headers: {
        'X-Key': '$&',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from('name:value').toString('base64')}`,
      },
    }),
  );
  expect(response).toMatchObject({ status: 400, data: { error: 'expected' } });
  expect(response.size).toBeGreaterThan(0);
  expect(response.responseTime).toBeGreaterThanOrEqual(0);
});

test('rejects unsupported protocols and multipart before network execution', async () => {
  await expect(
    sendBrunoRequest({ http: { method: 'GET', url: 'file:///tmp/test' } }),
  ).rejects.toThrow('HTTP');
  await expect(
    sendBrunoRequest({
      http: { method: 'POST', url: 'https://example.test' },
      body: { multipartForm: [] },
    }),
  ).rejects.toThrow('multipart');
  expect(execute).not.toHaveBeenCalled();
});

test('returns send failures to the panel and handles empty responses', async () => {
  execute.mockRejectedValueOnce(new Error('Connection refused'));
  await expect(
    sendBrunoRequest({ http: { method: 'GET', url: 'https://example.test' } }),
  ).rejects.toThrow('Connection refused');
  execute.mockResolvedValueOnce({ status: 204, headers: {}, data: undefined });
  await expect(
    sendBrunoRequest({ http: { method: 'GET', url: 'https://example.test' } }),
  ).resolves.toMatchObject({ status: 204, size: 0 });
});
