/**
 * Shared OpenTelemetry Configuration
 *
 * Configuration types and defaults for both main and renderer process telemetry.
 */
export const defaultTelemetryConfig = {
    enabled: true,
    collectorEndpoint: 'http://localhost:4318',
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
export function isTelemetryEnabled() {
    if (typeof process !== 'undefined' && process.env?.DISABLE_TELEMETRY === 'true') {
        return false;
    }
    return defaultTelemetryConfig.enabled;
}
