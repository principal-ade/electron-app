import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DevSidecarServerStatusResponse } from '../../shared/main-process-api-interfaces/DevSidecarAPI';
import type { DevServerLifecycleStatus } from '../../shared/types/devServer.types';

const STATUS_LABELS: Record<DevServerLifecycleStatus, string> = {
  idle: 'Idle',
  starting: 'Starting…',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
};

const STATUS_CLASS: Record<DevServerLifecycleStatus, string> = {
  idle: 'status-idle',
  starting: 'status-starting',
  running: 'status-running',
  stopped: 'status-stopped',
  error: 'status-error',
};

export const SidecarApp: React.FC = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const projectPath = searchParams.get('projectPath') ?? undefined;
  const descriptorCommand = searchParams.get('command') ?? undefined;
  const descriptorArgs =
    searchParams
      .get('args')
      ?.split(',')
      .map((arg) => arg.trim())
      .filter(Boolean) ?? undefined;
  const defaultPort = searchParams.get('port');

  const [status, setStatus] = useState<DevServerLifecycleStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logsVisible, setLogsVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();

  const canControlServer = Boolean(sessionId && projectPath);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const handleStatus = (payload: DevSidecarServerStatusResponse) => {
      if (payload.sessionId !== sessionId) return;
      setStatus(payload.status as DevServerLifecycleStatus);
      setCurrentUrl(payload.url ?? undefined);
      setLastError(payload.lastError ?? undefined);
      if (payload.status === 'running' || payload.status === 'stopped' || payload.status === 'error') {
        setIsProcessing(false);
      }
    };

    const disposers = [
      window.mainProcess.devSidecar.onServerStatus(handleStatus),
      window.mainProcess.devSidecar.onServerStarted(handleStatus),
      window.mainProcess.devSidecar.onServerStopped(handleStatus),
      window.mainProcess.devSidecar.onServerError(handleStatus),
      window.mainProcess.devSidecar.onLogsToggled(({ sessionId: id, visible }) => {
        if (id !== sessionId) return;
        setLogsVisible(visible);
      }),
    ];

    window.mainProcess.devSidecar
      .getStatus(sessionId)
      .then(handleStatus)
      .catch((error) => {
        console.error('[DevSidecar] Failed to fetch status', error);
      });

    window.mainProcess.devSidecar
      .getBufferedLogs(sessionId)
      .catch(() => undefined);

    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }, [sessionId]);

  const handleStart = useCallback(async () => {
    if (!sessionId || !projectPath) return;
    setIsProcessing(true);
    try {
      const descriptor: {
        command?: string;
        args?: string[];
        cwd: string;
        port?: number;
      } = {
        cwd: projectPath,
      };
      if (descriptorCommand) {
        descriptor.command = descriptorCommand;
      }
      if (descriptorArgs && descriptorArgs.length > 0) {
        descriptor.args = descriptorArgs;
      }
      if (defaultPort) {
        const parsed = Number(defaultPort);
        if (!Number.isNaN(parsed)) {
          descriptor.port = parsed;
        }
      }

      await window.mainProcess.devSidecar.startServer({
        sessionId,
        projectPath,
        descriptor,
      });
    } catch (error) {
      console.error('[DevSidecar] Failed to start dev server', error);
      setIsProcessing(false);
      setLastError(error instanceof Error ? error.message : String(error));
    }
  }, [sessionId, projectPath, descriptorCommand, descriptorArgs, defaultPort]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    setIsProcessing(true);
    try {
      await window.mainProcess.devSidecar.stopServer({ sessionId });
    } catch (error) {
      console.error('[DevSidecar] Failed to stop dev server', error);
      setIsProcessing(false);
    }
  }, [sessionId]);

  const handleRestart = useCallback(async () => {
    if (!sessionId) return;
    setIsProcessing(true);
    try {
      const parsedPort = defaultPort ? Number(defaultPort) : undefined;
      await window.mainProcess.devSidecar.restartServer({
        sessionId,
        newPort: Number.isNaN(parsedPort ?? NaN) ? undefined : parsedPort,
      });
    } catch (error) {
      console.error('[DevSidecar] Failed to restart dev server', error);
      setIsProcessing(false);
    }
  }, [sessionId, defaultPort]);

  const handleToggleLogs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await window.mainProcess.devSidecar.toggleLogs(sessionId);
      setLogsVisible(result.visible);
    } catch (error) {
      console.error('[DevSidecar] Failed to toggle logs', error);
    }
  }, [sessionId]);

  const handleReload = useCallback(async () => {
    if (!sessionId) return;
    try {
      await window.mainProcess.devSidecar.reload(sessionId);
    } catch (error) {
      console.error('[DevSidecar] Failed to reload dev server view', error);
    }
  }, [sessionId]);

  const handleDevTools = useCallback(async () => {
    if (!sessionId) return;
    try {
      await window.mainProcess.devSidecar.toggleDevTools(sessionId);
    } catch (error) {
      console.error('[DevSidecar] Failed to toggle devtools', error);
    }
  }, [sessionId]);

  const handleFocus = useCallback(async () => {
    if (!sessionId) return;
    try {
      await window.mainProcess.devSidecar.focusWindow(sessionId);
    } catch (error) {
      console.error('[DevSidecar] Failed to focus window', error);
    }
  }, [sessionId]);

  const controlsDisabled = !sessionId || isProcessing;
  const startDisabled = controlsDisabled || !canControlServer || status === 'running' || status === 'starting';
  const stopDisabled = controlsDisabled || status === 'stopped' || status === 'idle';

  if (!sessionId) {
    return (
      <div className="sidecar-app">
        <header className="sidecar-header">
          <h1>Dev Sidecar</h1>
        </header>
        <main className="sidecar-body">
          <p className="sidecar-warning">Missing session id. Ensure the window is launched via the terminal integration.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="sidecar-app">
      <header className="sidecar-header" style={{ WebkitAppRegion: 'drag' }}>
        <div className="sidecar-title">
          <h1>Dev Sidecar</h1>
          <span className={`status-pill ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
        </div>
        <div className="sidecar-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          <button type="button" onClick={handleFocus} disabled={controlsDisabled}>
            Focus
          </button>
          <button type="button" onClick={handleStart} disabled={startDisabled}>
            Start
          </button>
          <button type="button" onClick={handleStop} disabled={stopDisabled}>
            Stop
          </button>
          <button
            type="button"
            onClick={handleRestart}
            disabled={controlsDisabled || !canControlServer || status === 'starting'}
          >
            Restart
          </button>
          <button type="button" onClick={handleReload} disabled={controlsDisabled}>
            Reload
          </button>
          <button type="button" onClick={handleDevTools} disabled={controlsDisabled}>
            DevTools
          </button>
          <button type="button" onClick={handleToggleLogs} disabled={!sessionId}>
            {logsVisible ? 'Hide Logs' : 'Show Logs'}
          </button>
        </div>
      </header>
      <main className="sidecar-body">
        <section className="sidecar-info">
          <dl>
            <div>
              <dt>Session</dt>
              <dd>{sessionId}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{projectPath ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{currentUrl ?? 'Not available yet'}</dd>
            </div>
          </dl>
          {lastError ? <p className="sidecar-error">{lastError}</p> : null}
        </section>
        <section className="sidecar-helper">
          <h2>Instructions</h2>
          <ul>
            <li>Use the controls above to manage the dev server lifecycle.</li>
            <li>Logs open in a dedicated BrowserView so you can inspect build output.</li>
            <li>The window automatically loads the dev server URL once it reports ready.</li>
          </ul>
        </section>
      </main>
    </div>
  );
};
