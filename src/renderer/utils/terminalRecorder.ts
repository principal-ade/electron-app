import { FileSystemService } from '../main-process-api/FileSystemService';

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

/**
 * Manages terminal data recording for debugging UI issues
 */
export class TerminalRecorder {
  private isRecording = false;
  private outputDirectory: string | null = null;
  private sessions = new Map<string, TerminalRecordingSession>();
  private eventCount = 0;
  private maxEventsPerFile = 1000; // Prevent files from getting too large

  /**
   * Start recording terminal data
   */
  async startRecording(): Promise<{
    success: boolean;
    directory?: string;
    error?: string;
  }> {
    try {
      // Open folder selector
      const result = await FileSystemService.selectDirectory({
        title: 'Select folder to save terminal recordings',
        buttonLabel: 'Select',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (
        !result ||
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return { success: false, error: 'No folder selected' };
      }

      this.outputDirectory = result.filePaths[0];
      this.isRecording = true;
      this.sessions.clear();
      this.eventCount = 0;

      console.log(
        '[TerminalRecorder] Recording started, output:',
        this.outputDirectory,
      );

      return { success: true, directory: this.outputDirectory };
    } catch (error) {
      console.error('[TerminalRecorder] Failed to start recording:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop recording and save all data
   */
  async stopRecording(): Promise<{
    success: boolean;
    files?: string[];
    error?: string;
  }> {
    if (!this.isRecording) {
      return { success: false, error: 'Not currently recording' };
    }

    this.isRecording = false;

    try {
      const files = await this.saveAllSessions();
      console.log('[TerminalRecorder] Recording stopped, saved files:', files);

      // Clear sessions after saving
      this.sessions.clear();
      this.eventCount = 0;

      return { success: true, files };
    } catch (error) {
      console.error('[TerminalRecorder] Failed to stop recording:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Record terminal data reception event
   */
  recordDataReceived(sessionId: string, data: string): void {
    if (!this.isRecording) return;

    this.recordEvent(sessionId, 'received', data);
  }

  /**
   * Record terminal data written to xterm
   */
  recordDataWritten(sessionId: string, data: string): void {
    if (!this.isRecording) return;

    this.recordEvent(sessionId, 'written', data);
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

    // Auto-save if we've accumulated too many events
    if (this.eventCount >= this.maxEventsPerFile) {
      this.saveAllSessions().catch((err) => {
        console.error('[TerminalRecorder] Failed to auto-save:', err);
      });
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
   * Get current output directory
   */
  getOutputDirectory(): string | null {
    return this.outputDirectory;
  }

  /**
   * Get current event count
   */
  getEventCount(): number {
    return this.eventCount;
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

    // Auto-save if we've accumulated too many events
    if (this.eventCount >= this.maxEventsPerFile) {
      this.saveAllSessions().catch((err) => {
        console.error('[TerminalRecorder] Failed to auto-save:', err);
      });
      this.sessions.clear();
      this.eventCount = 0;
    }
  }

  /**
   * Save all recorded sessions to files
   */
  private async saveAllSessions(): Promise<string[]> {
    if (!this.outputDirectory) {
      throw new Error('No output directory set');
    }

    const savedFiles: string[] = [];
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');

    const savePromises: Promise<void>[] = [];
    this.sessions.forEach((session, sessionId) => {
      if (session.events.length === 0) return;

      // Create a safe filename
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '_');
      const filename = `terminal-recording-${safeSessionId}-${timestamp}.json`;
      const filepath = `${this.outputDirectory}/${filename}`;

      // Prepare the data to save
      const recordingData = {
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

      const savePromise = FileSystemService.writeFile(
        filepath,
        JSON.stringify(recordingData, null, 2),
      )
        .then(() => {
          savedFiles.push(filepath);
          console.log(`[TerminalRecorder] Saved recording to ${filepath}`);
        })
        .catch((error) => {
          console.error(
            `[TerminalRecorder] Failed to save ${filepath}:`,
            error,
          );
        });

      savePromises.push(savePromise);
    });

    await Promise.all(savePromises);
    return savedFiles;
  }
}

// Singleton instance
export const terminalRecorder = new TerminalRecorder();
