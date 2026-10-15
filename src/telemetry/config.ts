/**
 * Shared OpenTelemetry configuration.
 *
 * Endpoint and on/off resolution, highest priority first:
 *
 *   1. the saved `telemetry` user preference (Settings → Telemetry)
 *   2. an environment variable (the dev escape hatch)
 *   3. the built-in default (`http://localhost:4318`, Maple local's port)
 *
 * The main process resolves this once and hands the result to every other
 * process, so there is exactly one source of truth: the renderer reads it off
 * `window` (see the `get-otel-endpoint` sync IPC), and the utility process and
 * PTY daemon receive it in their spawn environment.
 *
 * The endpoint is a BASE url. Callers append `/v1/traces` themselves; a pasted
 * full trace url is tolerated and stripped back to its base.
 */

/** Maple local (and the OTLP/HTTP convention in general) listens here. */
export const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';

/** Standard OTLP base endpoint env var, for pointing a checkout at any collector. */
export const OTLP_ENDPOINT_ENV = 'OTEL_EXPORTER_OTLP_ENDPOINT';

/** Set by the main process on a child process' env to carry the resolved value. */
export const RESOLVED_ENDPOINT_ENV = 'PRINCIPAL_TELEMETRY_ENDPOINT';
export const RESOLVED_ENABLED_ENV = 'PRINCIPAL_TELEMETRY_ENABLED';

/**
 * Port-only knobs this replaced. Still read as a fallback so an existing dev
 * shell (`OTEL_OTLP_PORT=4318 npm run dev`) keeps working; prefer
 * `OTEL_EXPORTER_OTLP_ENDPOINT`.
 */
export const LEGACY_OTLP_PORT_ENV = 'OTEL_OTLP_PORT';
export const LEGACY_WRAPPER_PORT_ENV = 'OTEL_WRAPPER_PORT';

/** The persisted slice of user preferences that drives telemetry. */
export interface TelemetryPreference {
  /** Export traces at all. Unset falls through to the environment. */
  enabled?: boolean;
  /** Base OTLP/HTTP endpoint. Unset or blank falls through to the default. */
  endpoint?: string;
}

/** The resolved answer every process runs on. */
export interface TelemetrySettings {
  enabled: boolean;
  endpoint: string;
}

/** Renderer-only localStorage key that predates the preference. */
export const LEGACY_RENDERER_ENABLED_KEY = 'telemetry-enabled';

/** Instrumentation toggles. Orthogonal to where (and whether) spans are exported. */
export interface TelemetryConfig {
  /** Default `service.name` for telemetry exported by the main process. */
  serviceName: string;
  mainProcess: {
    enabled: boolean;
    instrumentations: {
      http: boolean;
      express: boolean;
      fs: boolean;
    };
  };
  renderer: {
    enabled: boolean;
    instrumentations: {
      fetch: boolean;
      xhr: boolean;
      documentLoad: boolean;
      userInteraction: boolean;
    };
  };
}

/** Normalise a user-supplied endpoint to a bare origin+path, or undefined. */
export function normalizeOtlpEndpoint(
  raw: string | undefined,
): string | undefined {
  const value = raw?.trim();
  if (!value) {
    return undefined;
  }

  // Accept `localhost:4318` as well as a full url.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : `http://${value}`;

  return withScheme.replace(/\/+$/, '').replace(/\/v1\/traces$/, '');
}

/** `http://localhost:<port>` from a legacy port-only env var, or undefined. */
function legacyEndpointFromPort(
  env: Record<string, string | undefined>,
): string | undefined {
  const port = (
    env[LEGACY_OTLP_PORT_ENV] ??
    env[LEGACY_WRAPPER_PORT_ENV] ??
    ''
  ).trim();

  return /^\d+$/.test(port) ? `http://localhost:${port}` : undefined;
}

/**
 * Collapse the preference, the environment and the defaults into the settings a
 * process should run on. Callers pass whichever inputs they own: the main
 * process passes the saved preference plus its own env, a child process passes
 * only its env (the preference arrives as `RESOLVED_*` / `RESOLVED_ENDPOINT_ENV`).
 */
export function resolveTelemetrySettings(
  input: {
    preference?: TelemetryPreference | undefined;
    env?: Record<string, string | undefined> | undefined;
  } = {},
): TelemetrySettings {
  const env = input.env ?? {};
  const preference = input.preference ?? {};

  const endpoint =
    normalizeOtlpEndpoint(preference.endpoint) ??
    normalizeOtlpEndpoint(env[RESOLVED_ENDPOINT_ENV]) ??
    normalizeOtlpEndpoint(env[OTLP_ENDPOINT_ENV]) ??
    legacyEndpointFromPort(env) ??
    DEFAULT_OTLP_ENDPOINT;

  let enabled: boolean;
  if (preference.enabled !== undefined) {
    // An explicit choice in Settings beats the environment.
    enabled = preference.enabled;
  } else if (env[RESOLVED_ENABLED_ENV] !== undefined) {
    enabled = env[RESOLVED_ENABLED_ENV] !== 'false';
  } else if (env.DISABLE_TELEMETRY === 'true') {
    enabled = false;
  } else {
    enabled = true;
  }

  return { enabled, endpoint };
}

export const defaultTelemetryConfig: TelemetryConfig = {
  serviceName: 'principal-ade-main',
  mainProcess: {
    enabled: true,
    instrumentations: {
      http: true,
      express: true,
      fs: false, // Disabled by default - too noisy
    },
  },
  renderer: {
    enabled: true,
    instrumentations: {
      fetch: true,
      xhr: true,
      documentLoad: true,
      userInteraction: true,
    },
  },
};
