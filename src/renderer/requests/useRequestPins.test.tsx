import { act, renderHook, waitFor } from '@testing-library/react';
import { useRequestPins } from './useRequestPins';
import { BrunoService } from '../main-process-api/BrunoService';
import type { CatalogRequest } from '../../shared/requests/preparedRequest';

jest.mock('../main-process-api/BrunoService', () => ({
  BrunoService: {
    listRoutes: jest.fn(),
    onCatalogChanged: jest.fn(),
    pin: jest.fn(),
    unpin: jest.fn(),
    updateRoute: jest.fn(),
    forgetRoute: jest.fn(),
    sendRequest: jest.fn(),
  },
}));

const first: CatalogRequest = {
  id: 'one',
  title: 'First',
  request: { http: { method: 'GET', url: 'https://example.test/one' } },
  environment: {},
  pinned: false,
};
const second: CatalogRequest = {
  ...first,
  id: 'two',
  title: 'Second',
  request: { http: { method: 'POST', url: 'https://example.test/two' } },
};
let changed: () => void;
const unsubscribe = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  (BrunoService.listRoutes as jest.Mock).mockResolvedValue([]);
  (BrunoService.onCatalogChanged as jest.Mock).mockImplementation(
    (callback) => {
      changed = callback;
      return unsubscribe;
    },
  );
});

test('keeps the newest refresh when initial loading and rapid prepare events finish out of order', async () => {
  const initial = deferred<CatalogRequest[]>();
  const older = deferred<CatalogRequest[]>();
  const newest = deferred<CatalogRequest[]>();
  (BrunoService.listRoutes as jest.Mock)
    .mockReturnValueOnce(initial.promise)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newest.promise);
  const { result, unmount } = renderHook(useRequestPins);
  act(() => {
    changed();
    changed();
  });
  await act(async () => newest.resolve([first, second]));
  await act(async () => {
    older.resolve([first]);
    initial.resolve([]);
  });
  expect(result.current.catalogRequests).toEqual([first, second]);
  expect(result.current.savedRequests).toEqual([]);
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('a pending favorite write does not drop newly prepared routes or install its old snapshot', async () => {
  const pin = deferred<unknown>();
  let routes = [first];
  (BrunoService.listRoutes as jest.Mock).mockImplementation(async () => routes);
  (BrunoService.pin as jest.Mock).mockReturnValue(pin.promise);
  const { result } = renderHook(useRequestPins);
  await waitFor(() => expect(result.current.catalogRequests).toEqual([first]));
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.saveRequest(first);
  });
  expect(result.current.requestPinBusy).toBe(true);
  routes = [{ ...first, pinned: true }, second];
  await act(async () => changed());
  expect(result.current.catalogRequests).toEqual(routes);
  await act(async () => {
    pin.resolve([first]);
    await saving;
  });
  expect(result.current.catalogRequests).toEqual(routes);
  expect(result.current.savedRequests).toEqual([
    {
      id: first.id,
      title: first.title,
      request: first.request,
      environment: first.environment,
    },
  ]);
  expect(result.current.requestPinBusy).toBe(false);
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});
