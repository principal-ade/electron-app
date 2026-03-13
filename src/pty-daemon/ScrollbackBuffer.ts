/**
 * ScrollbackBuffer
 *
 * Circular buffer for storing terminal scrollback data.
 * Efficiently maintains a fixed number of lines while allowing
 * fast append and retrieval operations.
 */

import { SCROLLBACK_LINES, SCROLLBACK_MAX_BYTES } from '../shared/pty-daemon/constants';

export class ScrollbackBuffer {
  private lines: string[] = [];
  private maxLines: number;
  private maxBytes: number;
  private currentBytes: number = 0;

  constructor(maxLines: number = SCROLLBACK_LINES, maxBytes: number = SCROLLBACK_MAX_BYTES) {
    this.maxLines = maxLines;
    this.maxBytes = maxBytes;
  }

  /**
   * Append data to the buffer.
   * Data is split by newlines, with partial lines accumulated.
   */
  append(data: string): void {
    if (!data) return;

    // Split incoming data by newlines
    const parts = data.split(/\r?\n/);

    // If we have existing lines and first part doesn't start with newline,
    // append to last line
    if (this.lines.length > 0 && parts.length > 0) {
      const lastIndex = this.lines.length - 1;
      const oldLine = this.lines[lastIndex];
      const newLine = oldLine + parts[0];
      this.currentBytes += parts[0].length;
      this.lines[lastIndex] = newLine;
      parts.shift();
    }

    // Add remaining parts as new lines
    for (const part of parts) {
      this.lines.push(part);
      this.currentBytes += part.length + 1; // +1 for newline
    }

    // Trim if we exceed max lines
    this.trimLines();

    // Trim if we exceed max bytes
    this.trimBytes();
  }

  /**
   * Get all buffered content as a single string.
   */
  getAll(): string {
    return this.lines.join('\n');
  }

  /**
   * Get the number of lines in the buffer.
   */
  getLineCount(): number {
    return this.lines.length;
  }

  /**
   * Get the approximate byte size of the buffer.
   */
  getByteSize(): number {
    return this.currentBytes;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.lines = [];
    this.currentBytes = 0;
  }

  /**
   * Trim lines to max limit.
   */
  private trimLines(): void {
    if (this.lines.length > this.maxLines) {
      const removeCount = this.lines.length - this.maxLines;
      const removed = this.lines.splice(0, removeCount);

      // Update byte count
      for (const line of removed) {
        this.currentBytes -= line.length + 1;
      }
    }
  }

  /**
   * Trim bytes to max limit by removing oldest lines.
   */
  private trimBytes(): void {
    while (this.currentBytes > this.maxBytes && this.lines.length > 0) {
      const removed = this.lines.shift();
      if (removed) {
        this.currentBytes -= removed.length + 1;
      }
    }
  }
}
