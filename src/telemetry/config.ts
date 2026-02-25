/**
 * Shared OpenTelemetry Configuration
 *
 * Configuration types and defaults for both main and renderer process telemetry.
 */

/**
 * Extended window interface for renderer process
 */
interface WindowWithOtel {
  otelCollectorEndpoint?: string;
}

/**
 * Declare window as potentially available in global scope
 */
declare const window: WindowWithOtel | undefined;

export interface TelemetryConfig {
  enabled: boolean;
  collectorEndpoint: string;
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

/**
 * Get the OTLP endpoint based on environment
 * Sends directly to wrapper port: dev uses 14319, production uses 4319
 */
function getCollectorEndpoint(): string {
  // In renderer process, use the endpoint exposed by preload script
  if (typeof window !== 'undefined' && window?.otelCollectorEndpoint) {
    return window.otelCollectorEndpoint;
  }

  // In main process, check for environment variable override
  if (typeof process !== 'undefined' && process.env?.OTEL_OTLP_PORT) {
    return `http://localhost:${process.env.OTEL_OTLP_PORT}`;
  }

  // In main process, auto-detect dev vs production
  // Send directly to wrapper port (bypasses Go collector)
  if (typeof process !== 'undefined' && process.type === 'browser') {
    try {
      const { app } = require('electron');
      const isDev = !app.isPackaged;
      return `http://localhost:${isDev ? '14319' : '4319'}`;
    } catch {
      // Fallback if electron not available
      return 'http://localhost:4319';
    }
  }

  // Final fallback
  return 'http://localhost:4319';
}

export const defaultTelemetryConfig: TelemetryConfig = {
  enabled: true,
  collectorEndpoint: getCollectorEndpoint(),
  serviceName: 'principal-ade',
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

// Environment variable override
export function isTelemetryEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env?.DISABLE_TELEMETRY === 'true') {
    return false;
  }
  return defaultTelemetryConfig.enabled;
}
