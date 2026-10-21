/** @jest-environment node */
import { notifyRequestCatalogChanged } from './requestCatalogEvents';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';

jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));

test('invalidates live MAIN windows only, without any request payload', () => {
  applicationWindows.clear();
  const sends = [
    jest.fn(),
    jest.fn(),
    jest.fn(),
    jest.fn(() => {
      throw new Error('closing');
    }),
  ];
  [
    PrimaryWindowType.MAIN,
    PrimaryWindowType.DEV_WORKSPACE,
    PrimaryWindowType.MAIN,
    PrimaryWindowType.MAIN,
  ].forEach((primaryType, index) =>
    applicationWindows.set(index, {
      window: {
        isDestroyed: () => index === 2,
        webContents: { send: sends[index] },
      },
      metadata: { primaryType },
    } as never),
  );
  expect(() => notifyRequestCatalogChanged()).not.toThrow();
  expect(sends[0]).toHaveBeenCalledWith(BrunoAPIEvent.CATALOG_CHANGED);
  expect(sends[1]).not.toHaveBeenCalled();
  expect(sends[2]).not.toHaveBeenCalled();
  expect(sends[3]).toHaveBeenCalledWith(BrunoAPIEvent.CATALOG_CHANGED);
});
