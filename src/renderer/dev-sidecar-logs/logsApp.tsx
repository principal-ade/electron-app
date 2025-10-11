import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DevServerLogEntry } from '../../shared/types/devServer.types';

interface LogLineProps {
  entry: DevServerLogEntry;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const LogLine: React.FC<LogLineProps> = ({ entry }) => {
  const time = formatter.format(entry.timestamp);
  return (
    <div className={`log-line log-${entry.stream}`} data-stream={entry.stream}>
      <span className="log-timestamp">{time}</span>
      <span className="log-stream">{entry.stream}</span>
      <span className="log-message">{entry.message}</span>
    </div>
  );
};

export const SidecarLogsApp: React.FC = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const [entries, setEntries] = useState<DevServerLogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isMounted = true;

    window.mainProcess.devSidecar
      .getBufferedLogs(sessionId)
      .then((buffered) => {
        if (!isMounted) return;
        setEntries(buffered);
      })
      .catch((error) => {
        console.error('[DevSidecar] Failed to fetch buffered logs', error);
      });

    const unsubscribeOutput = window.mainProcess.devSidecar.onServerOutput((entry) => {
      if (entry.sessionId !== sessionId) return;
      setEntries((prev) => {
        const next = [...prev, entry];
        if (next.length > 2000) {
          return next.slice(next.length - 2000);
        }
        return next;
      });
    });

    const unsubscribeStatus = window.mainProcess.devSidecar.onServerStatus((payload) => {
      if (payload.sessionId !== sessionId) return;
      if (payload.status === 'starting') {
        setEntries([]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeOutput();
      unsubscribeStatus();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleClear = () => {
    setEntries([]);
  };

  if (!sessionId) {
    return (
      <div className="logs-app">
        <header className="logs-header">
          <h1>Logs</h1>
        </header>
        <div className="logs-empty">Missing session id. Unable to stream logs.</div>
      </div>
    );
  }

  return (
    <div className="logs-app">
      <header className="logs-header">
        <div>
          <h1>Dev Server Logs</h1>
          <p className="logs-subtitle">Session {sessionId}</p>
        </div>
        <div className="logs-actions">
          <label className="logs-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            Auto-scroll
          </label>
          <button type="button" onClick={handleClear}>
            Clear
          </button>
        </div>
      </header>
      <div className="logs-container" ref={scrollRef}>
        {entries.length === 0 ? (
          <div className="logs-empty">Waiting for output…</div>
        ) : (
          entries.map((entry) => (
            <LogLine key={`${entry.timestamp}-${entry.stream}-${entry.message.substring(0, 20)}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
};
