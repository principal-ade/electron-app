# Terminal Scroll Recording Enhancement

## Overview

The `TerminalRecorder` has been enhanced to capture scroll position changes alongside terminal data flow. This allows you to correlate scroll bar behavior with the data being sent to and displayed in the terminal.

## What's Now Recorded

### Existing Data Events
- **Data Received** (`type: 'received'`): Data coming from the backend before being written to xterm
- **Data Written** (`type: 'written'`): Data being written to the xterm terminal instance

### New Scroll Events
- **Scroll Position Changes** (`type: 'scroll'`): Captured whenever the scroll position changes

## Scroll Event Data Structure

Each scroll event captures:

```typescript
{
  timestamp: number;           // When the scroll occurred
  sessionId: string;           // Terminal session ID
  type: 'scroll';              // Event type identifier
  scrollPosition: number;      // viewportY - current viewport position
  baseScrollback: number;      // baseY - base scrollback position
  rows: number;                // Number of visible rows
  isAtBottom: boolean;         // Whether viewport is at the bottom
  userScrolledAway: boolean;   // User manually scrolled away from bottom
  totalLines: number;          // Total lines (baseScrollback + rows)
  visibleRange: {
    start: number;             // First visible line
    end: number;               // Last visible line
  };
}
```

## When Scroll Events Are Recorded

1. **User Scrolling**: When user manually scrolls using mouse wheel, scrollbar, or keyboard
2. **Auto-scroll During Resize**: When terminal is resized and scroll position is adjusted
3. **Explicit scrollToBottom()**: When programmatically scrolled to bottom via API

## Recording Output

Recordings are saved as JSON files with the following structure:

```json
{
  "metadata": {
    "sessionId": "string",
    "startTime": 1234567890,
    "endTime": 1234567890,
    "duration": 12345,
    "eventCount": 150,
    "recordedAt": "2025-10-22T12:34:56.789Z"
  },
  "events": [
    {
      "timestamp": 1234567890,
      "sessionId": "session-123",
      "type": "received",
      "data": "...",
      "dataLength": 1024,
      "preview": "...",
      "charCodes": [...]
    },
    {
      "timestamp": 1234567891,
      "sessionId": "session-123",
      "type": "scroll",
      "scrollPosition": 100,
      "baseScrollback": 500,
      "rows": 24,
      "isAtBottom": false,
      "userScrolledAway": true,
      "totalLines": 524,
      "visibleRange": {
        "start": 100,
        "end": 124
      }
    },
    // ... more events
  ],
  "summary": {
    "totalDataReceived": 102400,
    "totalDataWritten": 102400,
    "receivedEventCount": 50,
    "writtenEventCount": 50,
    "scrollEventCount": 25
  }
}
```

## How to Use

1. **Start Recording**: Click the record button in the TabbedTerminalPanel UI
2. **Perform Actions**: Use the terminal normally, reproduce the scroll issue
3. **Stop Recording**: Click stop to save the recording

## Analyzing Scroll Issues

To debug scroll bar jumping issues:

1. Look for `scroll` events in the timeline
2. Check the `isAtBottom` and `userScrolledAway` flags
3. Correlate scroll events with preceding `received` or `written` events
4. Check if scroll position changes unexpectedly after data events

### Example Analysis

If the scroll bar jumps from bottom to top:

```
Event 1: type: "received", dataLength: 1024
Event 2: type: "written", dataLength: 1024
Event 3: type: "scroll", scrollPosition: 0, isAtBottom: false, userScrolledAway: false
```

This shows:
- Data was received and written
- Scroll jumped to position 0 (top)
- System didn't think user scrolled away
- But viewport is not at bottom

This pattern indicates an unexpected auto-scroll behavior triggered by the data write operation.

## Implementation Files

- `src/renderer/utils/terminalRecorder.ts` - Core recording logic
- `src/renderer/panels/components/xterminal/XTerminalPanel.tsx` - Scroll event capture integration
