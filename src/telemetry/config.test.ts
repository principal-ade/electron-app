import {
  DEFAULT_OTLP_ENDPOINT,
  LEGACY_OTLP_PORT_ENV,
  LEGACY_WRAPPER_PORT_ENV,
  OTLP_ENDPOINT_ENV,
  RESOLVED_ENABLED_ENV,
  RESOLVED_ENDPOINT_ENV,
  normalizeOtlpEndpoint,
  resolveTelemetrySettings,
} from './config';

describe('normalizeOtlpEndpoint', () => {
  it('keeps a scheme-qualified base url and trims the trailing slash', () => {
    expect(normalizeOtlpEndpoint('http://127.0.0.1:4318/')).toBe(
      'http://127.0.0.1:4318',
    );
  });

  it('adds a scheme to a bare host:port', () => {
    expect(normalizeOtlpEndpoint('localhost:4318')).toBe('http://localhost:4318');
  });

  it('strips a pasted full trace path back to the base', () => {
    expect(
      normalizeOtlpEndpoint('https://ingest.example.com/v1/traces'),
    ).toBe('https://ingest.example.com');
  });

  it('treats blank input as unset', () => {
    expect(normalizeOtlpEndpoint('')).toBeUndefined();
    expect(normalizeOtlpEndpoint('   ')).toBeUndefined();
    expect(normalizeOtlpEndpoint(undefined)).toBeUndefined();
  });
});

describe('resolveTelemetrySettings', () => {
  it('falls back to the built-in default with nothing configured', () => {
    expect(resolveTelemetrySettings()).toEqual({
      enabled: true,
      endpoint: DEFAULT_OTLP_ENDPOINT,
    });
  });

  it('applies the saved preference over the environment', () => {
    expect(
      resolveTelemetrySettings({
        preference: { endpoint: 'http://preference:9999' },
        env: { [OTLP_ENDPOINT_ENV]: 'http://environment:8888' },
      }).endpoint,
    ).toBe('http://preference:9999');
  });

  it('uses the environment when no preference is saved', () => {
    expect(
      resolveTelemetrySettings({
        env: { [OTLP_ENDPOINT_ENV]: 'http://environment:8888' },
      }).endpoint,
    ).toBe('http://environment:8888');
  });

  it('prefers the value the main process resolved over the standard env var', () => {
    expect(
      resolveTelemetrySettings({
        env: {
          [RESOLVED_ENDPOINT_ENV]: 'http://resolved:7777',
          [OTLP_ENDPOINT_ENV]: 'http://environment:8888',
        },
      }).endpoint,
    ).toBe('http://resolved:7777');
  });

  it.each([LEGACY_OTLP_PORT_ENV, LEGACY_WRAPPER_PORT_ENV])(
    'still honours the deprecated %s port knob',
    (knob) => {
      expect(
        resolveTelemetrySettings({ env: { [knob]: '14318' } }).endpoint,
      ).toBe('http://localhost:14318');
    },
  );

  it('ignores a non-numeric legacy port', () => {
    expect(
      resolveTelemetrySettings({ env: { [LEGACY_OTLP_PORT_ENV]: 'nope' } })
        .endpoint,
    ).toBe(DEFAULT_OTLP_ENDPOINT);
  });

  it('lets a cleared preference fall back to the environment', () => {
    expect(
      resolveTelemetrySettings({
        preference: { endpoint: '' },
        env: { [OTLP_ENDPOINT_ENV]: 'http://environment:8888' },
      }).endpoint,
    ).toBe('http://environment:8888');
  });

  it('honours DISABLE_TELEMETRY while no preference is saved', () => {
    expect(resolveTelemetrySettings({ env: { DISABLE_TELEMETRY: 'true' } }).enabled).toBe(
      false,
    );
  });

  it('lets an explicit saved choice beat DISABLE_TELEMETRY', () => {
    expect(
      resolveTelemetrySettings({
        preference: { enabled: true },
        env: { DISABLE_TELEMETRY: 'true' },
      }).enabled,
    ).toBe(true);
  });

  it('honours the resolved flag a child process inherits', () => {
    expect(
      resolveTelemetrySettings({ env: { [RESOLVED_ENABLED_ENV]: 'false' } })
        .enabled,
    ).toBe(false);
  });
});
