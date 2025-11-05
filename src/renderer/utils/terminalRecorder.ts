export interface TerminalDataEvent {
  timestamp: number;
  sessionId: string;
  type: 'received' | 'written';
  data: string;
  dataLength: number;
  // ANSI escape codes preview for debugging
  preview: string;
  // Character codes for detailed analysis
  charCodes?: number[];
}

export interface TerminalScrollEvent {
  timestamp: number;
  sessionId: string;
  type: 'scroll';
  scrollPosition: number;
  baseScrollback: number;
  rows: number;
  isAtBottom: boolean;
  userScrolledAway: boolean;
  // Calculated fields for analysis
  totalLines: number;
  visibleRange: {
    start: number;
    end: number;
  };
}

export interface TerminalRecordingSession {
  sessionId: string;
  startTime: number;
  events: Array<TerminalDataEvent | TerminalScrollEvent>;
}

export interface RecordingMetadata {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  eventCount: number;
  recordedAt: string;
}

export interface RecordingSummary {
  totalDataReceived: number;
  totalDataWritten: number;
  receivedEventCount: number;
  writtenEventCount: number;
  scrollEventCount: number;
}

export interface RecordingData {
  metadata: RecordingMetadata;
  events: Array<TerminalDataEvent | TerminalScrollEvent>;
  summary: RecordingSummary;
}

// Simple event emitter for recording updates
type RecordingEventListener = () => void;
type RecordingDataListener = (sessionId: string, data: string) => void;

/**
 * Manages terminal data recording for debugging UI issues
 */
export class TerminalRecorder {
  private isRecording = false;
  private sessions = new Map<string, TerminalRecordingSession>();
  private eventCount = 0;
  private maxEventsInMemory = 10000; // Prevent memory issues
  private completedRecordings: RecordingData[] = [];
  private listeners: RecordingEventListener[] = [];
  private dataListeners: RecordingDataListener[] = [];

  /**
   * Start recording terminal data
   * @param initialBuffer - Optional initial terminal buffer to include in the recording
   */
  async startRecording(initialBuffer?: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      this.isRecording = true;
      this.sessions.clear();
      this.eventCount = 0;

      console.log('[TerminalRecorder] Recording started (in-memory mode)');

      // If initial buffer provided, send it to live listeners
      if (initialBuffer) {
        console.log('[TerminalRecorder] Broadcasting initial buffer to live listeners');
        this.notifyDataListeners('initial', initialBuffer);
      }

      return { success: true };
    } catch (error) {
      console.error('[TerminalRecorder] Failed to start recording:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop recording and finalize data
   */
  async stopRecording(): Promise<{
    success: boolean;
    recordingCount?: number;
    error?: string;
  }> {
    if (!this.isRecording) {
      return { success: false, error: 'Not currently recording' };
    }

    this.isRecording = false;

    try {
      // Finalize all sessions
      this.finalizeSessions();

      console.log('[TerminalRecorder] Recording stopped, recordings in memory:', this.completedRecordings.length);

      // Notify listeners that recordings have been updated
      this.notifyListeners();

      return { success: true, recordingCount: this.completedRecordings.length };
    } catch (error) {
      console.error('[TerminalRecorder] Failed to stop recording:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Add a listener for recording updates
   */
  addListener(listener: RecordingEventListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Add a listener for live terminal data (mirrors recording in real-time)
   */
  addDataListener(listener: RecordingDataListener): () => void {
    this.dataListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.dataListeners.indexOf(listener);
      if (index > -1) {
        this.dataListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of recording updates
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[TerminalRecorder] Error in listener:', error);
      }
    });
  }

  /**
   * Notify data listeners of new terminal data
   */
  private notifyDataListeners(sessionId: string, data: string): void {
    this.dataListeners.forEach((listener) => {
      try {
        listener(sessionId, data);
      } catch (error) {
        console.error('[TerminalRecorder] Error in data listener:', error);
      }
    });
  }

  /**
   * Record terminal data reception event
   */
  recordDataReceived(sessionId: string, data: string): void {
    if (!this.isRecording) {
      return;
    }

    this.recordEvent(sessionId, 'received', data);
  }

  /**
   * Record terminal data written to xterm
   */
  recordDataWritten(sessionId: string, data: string): void {
    if (!this.isRecording) {
      return;
    }

    this.recordEvent(sessionId, 'written', data);

    // Notify live listeners for real-time display
    this.notifyDataListeners(sessionId, data);
  }

  /**
   * Record terminal scroll event
   */
  recordScrollEvent(
    sessionId: string,
    scrollPosition: number,
    baseScrollback: number,
    rows: number,
    isAtBottom: boolean,
    userScrolledAway: boolean,
  ): void {
    if (!this.isRecording) return;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        events: [],
      });
    }

    const session = this.sessions.get(sessionId)!;

    const totalLines = baseScrollback + rows;
    const event: TerminalScrollEvent = {
      timestamp: Date.now(),
      sessionId,
      type: 'scroll',
      scrollPosition,
      baseScrollback,
      rows,
      isAtBottom,
      userScrolledAway,
      totalLines,
      visibleRange: {
        start: scrollPosition,
        end: scrollPosition + rows,
      },
    };

    session.events.push(event);
    this.eventCount++;

    // Warn if we've accumulated too many events
    if (this.eventCount >= this.maxEventsInMemory) {
      console.warn('[TerminalRecorder] Event limit reached, automatically finalizing current sessions');
      this.finalizeSessions();
      this.sessions.clear();
      this.eventCount = 0;
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current event count
   */
  getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Get current session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all completed recordings
   */
  getRecordings(): RecordingData[] {
    return this.completedRecordings;
  }

  /**
   * Get the most recent recording
   */
  getLatestRecording(): RecordingData | null {
    if (this.completedRecordings.length === 0) {
      return null;
    }
    return this.completedRecordings[this.completedRecordings.length - 1];
  }

  /**
   * Clear all completed recordings from memory
   */
  clearRecordings(): void {
    this.completedRecordings = [];
    console.log('[TerminalRecorder] All recordings cleared from memory');
  }

  /**
   * Delete a specific recording by index
   */
  deleteRecording(index: number): boolean {
    if (index >= 0 && index < this.completedRecordings.length) {
      this.completedRecordings.splice(index, 1);
      console.log('[TerminalRecorder] Recording at index', index, 'deleted');
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Internal method to record an event
   */
  private recordEvent(
    sessionId: string,
    type: 'received' | 'written',
    data: string,
  ): void {
    if (!this.sessions.has(sessionId)) {
      console.log(`[TerminalRecorder] Creating new session: ${sessionId.substring(0, 8)}`);
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        events: [],
      });
    }

    const session = this.sessions.get(sessionId)!;

    // Create preview (first 100 chars, with escape codes visible)
    const preview = data.substring(0, 100).replace(/\x1b/g, '\\x1b');

    // Optionally capture char codes for detailed analysis (only for first 50 chars to save space)
    const charCodes =
      data.length <= 50
        ? Array.from(data).map((c) => c.charCodeAt(0))
        : undefined;

    const event: TerminalDataEvent = {
      timestamp: Date.now(),
      sessionId,
      type,
      data,
      dataLength: data.length,
      preview,
      charCodes,
    };

    session.events.push(event);
    this.eventCount++;

    if (this.eventCount % 100 === 0) {
      console.log(`[TerminalRecorder] Event count: ${this.eventCount}, sessions: ${this.sessions.size}`);
    }

    // Warn if we've accumulated too many events
    if (this.eventCount >= this.maxEventsInMemory) {
      console.warn('[TerminalRecorder] Event limit reached, automatically finalizing current sessions');
      this.finalizeSessions();
      this.sessions.clear();
      this.eventCount = 0;
    }
  }

  /**
   * Finalize all recorded sessions and move to completed recordings
   */
  private finalizeSessions(): void {
    console.log(`[TerminalRecorder] Finalizing ${this.sessions.size} sessions`);
    this.sessions.forEach((session) => {
      console.log(`[TerminalRecorder] Session ${session.sessionId.substring(0, 8)} has ${session.events.length} events`);
      if (session.events.length === 0) return;

      // Sort events by timestamp (ensure chronological order)
      session.events.sort((a, b) => a.timestamp - b.timestamp);

      const recordingData: RecordingData = {
        metadata: {
          sessionId: session.sessionId,
          startTime: session.startTime,
          endTime: Date.now(),
          duration: Date.now() - session.startTime,
          eventCount: session.events.length,
          recordedAt: new Date().toISOString(),
        },
        events: session.events,
        summary: {
          totalDataReceived: session.events
            .filter((e) => e.type === 'received')
            .reduce((sum, e) => sum + (e as TerminalDataEvent).dataLength, 0),
          totalDataWritten: session.events
            .filter((e) => e.type === 'written')
            .reduce((sum, e) => sum + (e as TerminalDataEvent).dataLength, 0),
          receivedEventCount: session.events.filter(
            (e) => e.type === 'received',
          ).length,
          writtenEventCount: session.events.filter((e) => e.type === 'written')
            .length,
          scrollEventCount: session.events.filter((e) => e.type === 'scroll')
            .length,
        },
      };

      this.completedRecordings.push(recordingData);
      console.log(`[TerminalRecorder] Finalized recording for session ${session.sessionId}`);
    });
  }
}

// Singleton instance
export const terminalRecorder = new TerminalRecorder();
