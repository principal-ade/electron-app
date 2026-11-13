import {
  AUTO_SYNC_INTERVAL_OPTIONS,
  formatAutoSyncInterval,
  normalizeAutoSyncSettings,
} from './autoSyncPrefs';

describe('normalizeAutoSyncSettings', () => {
  test('defaults to off with a 30-minute cadence', () => {
    expect(normalizeAutoSyncSettings(null)).toEqual({
      enabled: false,
      intervalMinutes: 30,
    });
    expect(normalizeAutoSyncSettings({})).toEqual({
      enabled: false,
      intervalMinutes: 30,
    });
  });

  test('keeps a valid stored cadence', () => {
    expect(
      normalizeAutoSyncSettings({
        repositoryAutoSync: { enabled: true, intervalMinutes: 60 },
      }),
    ).toEqual({ enabled: true, intervalMinutes: 60 });
  });

  test('falls back for missing or invalid cadences', () => {
    expect(
      normalizeAutoSyncSettings({ repositoryAutoSync: { enabled: true } }),
    ).toEqual({ enabled: true, intervalMinutes: 30 });
    expect(
      normalizeAutoSyncSettings({
        repositoryAutoSync: { enabled: true, intervalMinutes: 7 },
      }),
    ).toEqual({ enabled: true, intervalMinutes: 30 });
    expect(
      normalizeAutoSyncSettings({
        repositoryAutoSync: { enabled: true, intervalMinutes: NaN },
      }),
    ).toEqual({ enabled: true, intervalMinutes: 30 });
  });
});

describe('auto-sync interval options', () => {
  test('every option formats and round-trips through normalization', () => {
    for (const minutes of AUTO_SYNC_INTERVAL_OPTIONS) {
      expect(typeof formatAutoSyncInterval(minutes)).toBe('string');
      expect(
        normalizeAutoSyncSettings({
          repositoryAutoSync: { enabled: true, intervalMinutes: minutes },
        }).intervalMinutes,
      ).toBe(minutes);
    }
  });

  test('formats hours', () => {
    expect(formatAutoSyncInterval(60)).toBe('1 hour');
    expect(formatAutoSyncInterval(120)).toBe('2 hours');
    expect(formatAutoSyncInterval(15)).toBe('15 minutes');
  });
});
