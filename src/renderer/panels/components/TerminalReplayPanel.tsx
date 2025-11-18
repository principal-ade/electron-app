import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  List,
  Trash2,
  Clock,
  Activity,
  Radio,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  terminalRecorder,
  type TerminalDataEvent,
  type TerminalScrollEvent,
  type RecordingData,
} from '../../utils/terminalRecorder';
import '@xterm/xterm/css/xterm.css';

interface LoadedRecording {
  recordingIndex: number;
  data: RecordingData;
}

export const TerminalReplayPanel: React.FC = () => {
  console.log('[TerminalReplayPanel] Component mounted/rendering');

  const { theme } = useTheme();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [recording, setRecording] = useState<LoadedRecording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showRecordingList, setShowRecordingList] = useState(false);
  const [availableRecordings, setAvailableRecordings] = useState<RecordingData[]>([]);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [recordingEventCount, setRecordingEventCount] = useState(0);

  console.log('[TerminalReplayPanel] State:', {
    hasRecording: !!recording,
    isPlaying,
    currentEventIndex,
    availableRecordingsCount: availableRecordings.length,
  });

  // Initialize xterm.js
  useEffect(() => {
    console.log('[TerminalReplayPanel] xterm init effect running', {
      hasTerminalRef: !!terminalRef.current,
      hasXtermRef: !!xtermRef.current,
    });
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.accent,
        selectionBackground: theme.accentMuted,
        black: theme.background,
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#339af0',
        magenta: '#cc5de8',
        cyan: '#22b8cf',
        white: theme.foreground,
        brightBlack: theme.muted,
        brightRed: '#ff8787',
        brightGreen: '#69db7c',
        brightYellow: '#ffe066',
        brightBlue: '#4dabf7',
        brightMagenta: '#da77f2',
        brightCyan: '#3bc9db',
        brightWhite: theme.foreground,
      },
      cursorBlink: false,
      disableStdin: true, // Read-only for replay
      rows: 30,
      cols: 100,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (err) {
          console.warn('[TerminalReplayPanel] Fit failed:', err);
        }
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [theme]);

  // Refresh available recordings
  const refreshRecordings = useCallback(() => {
    const recordings = terminalRecorder.getRecordings();
    console.log('[TerminalReplayPanel] Refreshing recordings, found:', recordings.length);
    setAvailableRecordings(recordings);
  }, []);

  // Load recording from memory
  const loadRecording = useCallback((recordingIndex: number) => {
    try {
      const recordings = terminalRecorder.getRecordings();

      if (recordingIndex < 0 || recordingIndex >= recordings.length) {
        throw new Error('Invalid recording index');
      }

      const data = recordings[recordingIndex];

      // Validate structure
      if (!data.metadata || !data.events || !Array.isArray(data.events)) {
        throw new Error('Invalid recording data format');
      }

      setRecording({ recordingIndex, data });
      setCurrentEventIndex(0);
      setIsPlaying(false);
      setShowRecordingList(false);

      // Clear terminal and show first frame
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.write('Recording loaded. Press Play to start.\r\n\r\n');
        xtermRef.current.write(`Session: ${data.metadata.sessionId}\r\n`);
        xtermRef.current.write(`Duration: ${(data.metadata.duration / 1000).toFixed(2)}s\r\n`);
        xtermRef.current.write(`Events: ${data.metadata.eventCount}\r\n`);
      }

      console.log('[TerminalReplayPanel] Loaded recording:', recordingIndex, data);
    } catch (error) {
      console.error('[TerminalReplayPanel] Failed to load recording:', error);
      alert(`Failed to load recording: ${error}`);
    }
  }, []);

  // Poll for recording status
  useEffect(() => {
    const interval = setInterval(() => {
      const isRecording = terminalRecorder.isCurrentlyRecording();
      const eventCount = terminalRecorder.getEventCount();
      setIsRecordingActive(isRecording);
      setRecordingEventCount(eventCount);
    }, 500); // Poll every 500ms

    return () => clearInterval(interval);
  }, []);

  // Clear terminal when recording starts
  useEffect(() => {
    if (isRecordingActive && xtermRef.current && !recording) {
      console.log('[TerminalReplayPanel] Recording started - clearing terminal for live view');
      xtermRef.current.clear();
      xtermRef.current.write('🔴 Live Recording View\r\n\r\n');
    } else if (!isRecordingActive && xtermRef.current && !recording) {
      // Recording stopped and no playback loaded - show empty state
      xtermRef.current.clear();
    }
  }, [isRecordingActive, recording]);

  // Listen for live terminal data during recording
  useEffect(() => {
    const unsubscribe = terminalRecorder.addDataListener((sessionId, data) => {
      // Only show live data if we're actively recording and not playing back
      if (isRecordingActive && !isPlaying && xtermRef.current) {
        // Show escape codes for debugging
        const preview = data.replace(/\r/g, '\\r').replace(/\n/g, '\\n').substring(0, 100);
        console.log('[TerminalReplayPanel] Live data:', preview, 'length:', data.length);
        xtermRef.current.write(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isRecordingActive, isPlaying]);

  // Load latest recording automatically and listen for updates
  useEffect(() => {
    console.log('[TerminalReplayPanel] Main effect running - setting up recordings and listener');
    refreshRecordings();
    const latest = terminalRecorder.getLatestRecording();
    console.log('[TerminalReplayPanel] Latest recording:', latest ? 'found' : 'none');
    if (latest && !recording) {
      const recordings = terminalRecorder.getRecordings();
      const latestIndex = recordings.length - 1;
      console.log('[TerminalReplayPanel] Auto-loading recording at index:', latestIndex);
      if (latestIndex >= 0) {
        loadRecording(latestIndex);
      }
    }

    // Listen for recording updates
    const unsubscribe = terminalRecorder.addListener(() => {
      console.log('[TerminalReplayPanel] Recording update detected, refreshing list');
      refreshRecordings();

      // Auto-load the latest recording if we don't have one loaded
      if (!recording) {
        const recordings = terminalRecorder.getRecordings();
        const latestIndex = recordings.length - 1;
        if (latestIndex >= 0) {
          loadRecording(latestIndex);
        }
      }
    });

    console.log('[TerminalReplayPanel] Listener registered');
    return () => {
      console.log('[TerminalReplayPanel] Cleaning up listener');
      unsubscribe();
    };
  }, [recording, loadRecording, refreshRecordings]);

  // Delete a recording
  const deleteRecording = useCallback((index: number) => {
    if (window.confirm('Are you sure you want to delete this recording?')) {
      terminalRecorder.deleteRecording(index);
      refreshRecordings();

      // If we deleted the currently loaded recording, clear it
      if (recording && recording.recordingIndex === index) {
        setRecording(null);
        if (xtermRef.current) {
          xtermRef.current.clear();
        }
      }
    }
  }, [recording, refreshRecordings]);

  // Reset replay
  const resetReplay = useCallback(() => {
    setIsPlaying(false);
    setCurrentEventIndex(0);

    if (xtermRef.current && recording) {
      xtermRef.current.clear();
      xtermRef.current.write('Replay reset. Press Play to start.\r\n');
    }

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, [recording]);

  // Play/Pause control
  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Process single event
  const processEvent = useCallback(
    (event: TerminalDataEvent | TerminalScrollEvent, index: number) => {
      if (!xtermRef.current) {
        console.warn('[TerminalReplayPanel] No xterm instance available');
        return;
      }

      if (event.type === 'written' || event.type === 'received') {
        // Write data to terminal
        const dataEvent = event as TerminalDataEvent;
        console.log(`[TerminalReplayPanel] Processing ${event.type} event ${index}:`, dataEvent.preview);
        xtermRef.current.write(dataEvent.data);
      } else if (event.type === 'scroll') {
        // Apply scroll position
        const scrollEvent = event as TerminalScrollEvent;
        console.log(`[TerminalReplayPanel] Processing scroll event ${index}`);
        try {
          // Scroll to specific position
          if (xtermRef.current.buffer.active) {
            xtermRef.current.scrollToLine(scrollEvent.scrollPosition);
          }
        } catch (err) {
          console.warn('[TerminalReplayPanel] Scroll failed:', err);
        }
      }

      setCurrentEventIndex(index + 1);
    },
    [],
  );

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !recording || currentEventIndex >= recording.data.events.length) {
      if (currentEventIndex >= recording?.data.events.length && isPlaying) {
        console.log('[TerminalReplayPanel] Playback finished');
        setIsPlaying(false); // Auto-stop at end
      }
      return;
    }

    console.log(`[TerminalReplayPanel] Playback loop - event ${currentEventIndex}/${recording.data.events.length}`);

    const events = recording.data.events;
    const currentEvent = events[currentEventIndex];
    const nextIndex = currentEventIndex + 1;

    // Calculate delay until next event
    let delay = 0;
    if (nextIndex < events.length) {
      const nextEvent = events[nextIndex];
      delay = (nextEvent.timestamp - currentEvent.timestamp) / playbackSpeed;
    }

    console.log(`[TerminalReplayPanel] Delay until next event: ${delay}ms`);

    // Process current event
    processEvent(currentEvent, currentEventIndex);

    // Schedule next event
    if (nextIndex < events.length && delay > 0) {
      playbackTimerRef.current = setTimeout(() => {
        // Timer will be cleared by next effect run
      }, Math.max(delay, 1)); // Minimum 1ms delay
    }

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, currentEventIndex, recording, playbackSpeed, processEvent]);

  // Step forward
  const stepForward = useCallback(() => {
    if (!recording || currentEventIndex >= recording.data.events.length) return;
    processEvent(recording.data.events[currentEventIndex], currentEventIndex);
  }, [recording, currentEventIndex, processEvent]);

  // Step backward
  const stepBackward = useCallback(() => {
    if (!recording || currentEventIndex <= 0) return;

    // Replay from start up to previous event
    setCurrentEventIndex(0);
    setIsPlaying(false);

    if (xtermRef.current) {
      xtermRef.current.clear();

      // Replay all events up to target index
      const targetIndex = currentEventIndex - 1;
      for (let i = 0; i < targetIndex; i++) {
        const event = recording.data.events[i];
        if (event.type === 'written' || event.type === 'received') {
          const dataEvent = event as TerminalDataEvent;
          xtermRef.current.write(dataEvent.data);
        }
      }

      setCurrentEventIndex(targetIndex);
    }
  }, [recording, currentEventIndex]);

  // Progress percentage
  const progress = recording
    ? (currentEventIndex / recording.data.events.length) * 100
    : 0;

  // Current event for details view
  const currentEvent =
    recording && currentEventIndex < recording.data.events.length
      ? recording.data.events[currentEventIndex]
      : null;

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
        `}
      </style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          backgroundColor: theme.background,
          color: theme.foreground,
          fontFamily: theme.fontFamily,
        }}
      >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.border}`,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color={theme.accent} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Terminal Replay
          </span>
          {recording && (
            <span
              style={{
                fontSize: '12px',
                color: theme.muted,
                marginLeft: '8px',
              }}
            >
              Session: {recording.data.metadata.sessionId.substring(0, 8)}
            </span>
          )}
          {isRecordingActive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: '#ff000020',
                border: '1px solid #ff0000',
                borderRadius: '4px',
                marginLeft: '8px',
              }}
            >
              <Radio
                size={12}
                color="#ff0000"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: '11px', color: '#ff0000', fontWeight: 500 }}>
                Recording: {recordingEventCount} events
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              refreshRecordings();
              setShowRecordingList(!showRecordingList);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: showRecordingList ? theme.accent : theme.backgroundElevated,
              color: showRecordingList ? theme.background : theme.foreground,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <List size={14} />
            Recordings ({availableRecordings.length})
          </button>
        </div>
      </div>

      {/* Recording List */}
      {showRecordingList && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.border}`,
            backgroundColor: theme.backgroundElevated,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>
            Available Recordings
          </div>
          {availableRecordings.length === 0 ? (
            <div style={{ color: theme.muted, fontSize: '12px', padding: '8px 0' }}>
              No recordings available. Start a terminal session and record it first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableRecordings.map((rec, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: recording?.recordingIndex === index ? theme.accent + '20' : theme.background,
                    border: `1px solid ${recording?.recordingIndex === index ? theme.accent : theme.border}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadRecording(index)}>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                      Session: {rec.metadata.sessionId.substring(0, 12)}...
                    </div>
                    <div style={{ color: theme.muted, fontSize: '11px' }}>
                      {new Date(rec.metadata.recordedAt).toLocaleString()} •
                      {' '}{(rec.metadata.duration / 1000).toFixed(1)}s •
                      {' '}{rec.metadata.eventCount} events
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecording(index);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      color: theme.muted,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    title="Delete recording"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terminal Display */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '8px',
          backgroundColor: theme.background,
        }}
      />

      {/* Playback Controls */}
      {recording && (
        <>
          {/* Progress Bar */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: theme.muted, minWidth: '80px' }}>
                Event {currentEventIndex} / {recording.data.events.length}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: theme.border,
                  borderRadius: '3px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = clickX / rect.width;
                  const targetIndex = Math.floor(
                    percentage * recording.data.events.length,
                  );

                  // Replay from start to target
                  setCurrentEventIndex(0);
                  setIsPlaying(false);
                  if (xtermRef.current) {
                    xtermRef.current.clear();
                    for (let i = 0; i < targetIndex; i++) {
                      const event = recording.data.events[i];
                      if (event.type === 'written' || event.type === 'received') {
                        xtermRef.current.write((event as TerminalDataEvent).data);
                      }
                    }
                    setCurrentEventIndex(targetIndex);
                  }
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: theme.accent,
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: theme.muted }}>
                {progress.toFixed(1)}%
              </span>
            </div>

            {/* Control Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={resetReplay}
                style={{
                  padding: '8px 12px',
                  backgroundColor: theme.backgroundElevated,
                  color: theme.foreground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Reset"
              >
                <RotateCcw size={16} />
              </button>

              <button
                onClick={stepBackward}
                disabled={currentEventIndex <= 0}
                style={{
                  padding: '8px 12px',
                  backgroundColor: theme.backgroundElevated,
                  color: theme.foreground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor: currentEventIndex <= 0 ? 'not-allowed' : 'pointer',
                  opacity: currentEventIndex <= 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Step Back"
              >
                <SkipBack size={16} />
              </button>

              <button
                onClick={togglePlayback}
                disabled={currentEventIndex >= recording.data.events.length}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.accent,
                  color: theme.background,
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    currentEventIndex >= recording.data.events.length
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    currentEventIndex >= recording.data.events.length ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 500,
                }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                onClick={stepForward}
                disabled={currentEventIndex >= recording.data.events.length}
                style={{
                  padding: '8px 12px',
                  backgroundColor: theme.backgroundElevated,
                  color: theme.foreground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor:
                    currentEventIndex >= recording.data.events.length
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    currentEventIndex >= recording.data.events.length ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Step Forward"
              >
                <SkipForward size={16} />
              </button>

              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                style={{
                  padding: '8px',
                  backgroundColor: theme.backgroundElevated,
                  color: theme.foreground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
                <option value={10}>10x</option>
              </select>

              <button
                onClick={() => setShowEventDetails(!showEventDetails)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: showEventDetails
                    ? theme.accent
                    : theme.backgroundElevated,
                  color: showEventDetails ? theme.background : theme.foreground,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {showEventDetails ? 'Hide' : 'Show'} Details
              </button>
            </div>
          </div>

          {/* Event Details */}
          {showEventDetails && currentEvent && (
            <div
              style={{
                padding: '12px 16px',
                borderTop: `1px solid ${theme.border}`,
                backgroundColor: theme.backgroundElevated,
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>
                Current Event Details:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px' }}>
                <span style={{ color: theme.muted }}>Type:</span>
                <span>{currentEvent.type}</span>

                <span style={{ color: theme.muted }}>Timestamp:</span>
                <span>{new Date(currentEvent.timestamp).toISOString()}</span>

                {(currentEvent.type === 'written' ||
                  currentEvent.type === 'received') && (
                  <>
                    <span style={{ color: theme.muted }}>Data Length:</span>
                    <span>{(currentEvent as TerminalDataEvent).dataLength} bytes</span>

                    <span style={{ color: theme.muted }}>Preview:</span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        color: theme.accent,
                      }}
                    >
                      {(currentEvent as TerminalDataEvent).preview}
                    </span>
                  </>
                )}

                {currentEvent.type === 'scroll' && (
                  <>
                    <span style={{ color: theme.muted }}>Scroll Position:</span>
                    <span>{(currentEvent as TerminalScrollEvent).scrollPosition}</span>

                    <span style={{ color: theme.muted }}>Base Scrollback:</span>
                    <span>{(currentEvent as TerminalScrollEvent).baseScrollback}</span>

                    <span style={{ color: theme.muted }}>At Bottom:</span>
                    <span>
                      {(currentEvent as TerminalScrollEvent).isAtBottom ? 'Yes' : 'No'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!recording && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: '16px',
            color: theme.muted,
          }}
        >
          <Clock size={48} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
              No Recording Loaded
            </div>
            <div style={{ fontSize: '13px' }}>
              {availableRecordings.length === 0
                ? 'No recordings available. Start recording a terminal session first.'
                : 'Click "Recordings" to view and select from available recordings'}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
