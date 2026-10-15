import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';
import {
  DEFAULT_OTLP_ENDPOINT,
  OTLP_ENDPOINT_ENV,
} from '../../../../../telemetry/config';

/** Mirrors how the main process reports its own state, for the status line. */
interface ResolvedTelemetrySettings {
  endpoint: string;
  enabled: boolean;
}

export const TelemetrySettings: React.FC = () => {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [endpoint, setEndpoint] = useState('');
  const [resolved, setResolved] = useState<ResolvedTelemetrySettings | null>(
    null,
  );
  const [savedEndpoint, setSavedEndpoint] = useState('');

  useEffect(() => {
    let isMounted = true;

    const applyPreferences = (prefs: UserPreferences) => {
      if (!isMounted) return;

      setEnabled(prefs.telemetry?.enabled ?? true);
      setEndpoint(prefs.telemetry?.endpoint ?? '');
    };

    const readResolved = () => {
      try {
        const settings = window.getTelemetrySettings?.();
        if (settings) {
          setResolved(settings);
        }
      } catch {
        // The renderer falls back to the preload snapshot; nothing to show here.
      }
    };

    UserPreferencesService.getPreferences()
      .then((prefs) => {
        applyPreferences(prefs);
        setSavedEndpoint(prefs.telemetry?.endpoint ?? '');
        readResolved();
      })
      .catch(() => {
        // Leave the defaults in place.
      });

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        applyPreferences(detail);
        setSavedEndpoint(detail.telemetry?.endpoint ?? '');
        readResolved();
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  const commitEndpoint = async () => {
    const next = endpoint.trim();
    if (next === savedEndpoint) {
      return;
    }

    setSavedEndpoint(next);
    await UserPreferencesService.updatePreferences({
      telemetry: { endpoint: next },
    });
  };

  return (
    <div>
      <h3
        style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '8px',
          color: theme.colors.text,
        }}
      >
        Telemetry
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: theme.colors.textSecondary,
          marginBottom: '24px',
          maxWidth: '640px',
        }}
      >
        OpenTelemetry traces from this app&apos;s main process, renderer
        windows, the event-processing utility process and the terminal daemon
        are exported to an OTLP/HTTP collector. Point it at a local collector
        (Maple local listens on {DEFAULT_OTLP_ENDPOINT}) or leave the default.
      </p>

      {/* Export */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Export
        </h4>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={async (e) => {
                const next = e.target.checked;
                setEnabled(next);
                await UserPreferencesService.updatePreferences({
                  telemetry: { enabled: next },
                });
              }}
              style={{
                marginRight: '8px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
              }}
            />
            <span style={{ color: theme.colors.text }}>
              Export traces to an OTLP collector
            </span>
          </label>
          <p
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              marginTop: '8px',
              marginBottom: 0,
              marginLeft: '26px',
            }}
          >
            Renderer windows apply this immediately. The event-processing and
            terminal-daemon processes pick it up the next time they start.
          </p>
        </div>
      </div>

      {/* Endpoint */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          Collector endpoint
        </h4>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
            opacity: enabled ? 1 : 0.5,
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
              marginBottom: '12px',
            }}
          >
            Base OTLP/HTTP endpoint. <code>/v1/traces</code> is appended.
          </p>
          <input
            type="text"
            value={endpoint}
            disabled={!enabled}
            placeholder={DEFAULT_OTLP_ENDPOINT}
            onChange={(e) => setEndpoint(e.target.value)}
            onBlur={commitEndpoint}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                await commitEndpoint();
                e.currentTarget.blur();
              }
            }}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: '14px',
            }}
          />
          <p
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              marginTop: '12px',
              marginBottom: 0,
            }}
          >
            Leave blank to use {DEFAULT_OTLP_ENDPOINT}, or set{' '}
            <code>{OTLP_ENDPOINT_ENV}</code> before launching. A value saved
            here takes precedence over the environment.
          </p>
        </div>
      </div>

      {/* Resolved state */}
      <div style={{ marginBottom: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '16px',
            color: theme.colors.text,
          }}
        >
          In effect
        </h4>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: theme.colors.text,
              marginBottom: '8px',
            }}
          >
            Traces are {resolved?.enabled ? 'being exported' : 'not exported'} to{' '}
            <code>{resolved?.endpoint ?? DEFAULT_OTLP_ENDPOINT}</code>
          </p>
          <p
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              margin: 0,
            }}
          >
            The main process reports the resolved values here; they reflect the
            saved settings, the environment and the defaults, in that order.
          </p>
        </div>
      </div>
    </div>
  );
};
