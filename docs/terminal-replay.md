# Terminal Replay Panel

The Terminal Replay Panel allows you to record, store, and replay terminal sessions with synchronized data writes and scroll movements.

## Features

### Recording Terminal Sessions

Terminal recording is handled by the `TerminalRecorder` singleton (`src/renderer/utils/terminalRecorder.ts`).

**Start Recording:**
```typescript
import { terminalRecorder } from '../utils/terminalRecorder';

// User selects output directory via file picker
const result = await terminalRecorder.startRecording();
if (result.success) {
  console.log('Recording to:', result.directory);
}
```

**Stop Recording:**
```typescript
const result = await terminalRecorder.stopRecording();
if (result.success) {
  console.log('Saved files:', result.files);
}
```

The recorder captures three types of events:
1. **Data Received** - Data from PTY process to renderer
2. **Data Written** - Data written to xterm.js display
3. **Scroll Events** - Viewport position changes

### Recording File Format

```json
{
  "metadata": {
    "sessionId": "uuid",
    "startTime": 1234567890,
    "endTime": 1234567900,
    "duration": 10000,
    "eventCount": 125,
    "recordedAt": "2025-11-04T12:00:00.000Z"
  },
  "events": [
    {
      "timestamp": 1234567890,
      "sessionId": "uuid",
      "type": "written",
      "data": "\x1b[32mHello\x1b[0m",
      "dataLength": 14,
      "preview": "\\x1b[32mHello\\x1b[0m",
      "charCodes": [27, 91, 51, 50, 109, 72, 101, 108, 108, 111, 27, 91, 48, 109]
    },
    {
      "timestamp": 1234567891,
      "type": "scroll",
      "scrollPosition": 50,
      "baseScrollback": 0,
      "rows": 30,
      "isAtBottom": true,
      "userScrolledAway": false,
      "totalLines": 30,
      "visibleRange": { "start": 50, "end": 80 }
    }
  ],
  "summary": {
    "totalDataReceived": 5000,
    "totalDataWritten": 3000,
    "receivedEventCount": 50,
    "writtenEventCount": 75,
    "scrollEventCount": 0
  }
}
```

### Using the Replay Panel

The Terminal Replay Panel is available in the panel system:

1. **Open the Panel:**
   - Navigate to your repository view
   - Open the panel switcher
   - Select "Terminal Replay"

2. **Load a Recording:**
   - Click "Load Recording" button
   - Select a `.json` recording file
   - The terminal will display session metadata

3. **Playback Controls:**
   - **Play/Pause** - Start/stop playback
   - **Reset** - Clear terminal and return to start
   - **Step Forward** - Process next event
   - **Step Backward** - Replay from start to previous event
   - **Progress Bar** - Click to seek to specific position
   - **Speed Selector** - Adjust playback speed (0.25x to 10x)
   - **Show Details** - Display current event metadata

4. **Event Details View:**
   When enabled, shows detailed information about the current event:
   - Event type (written/received/scroll)
   - Timestamp
   - Data length and preview (for data events)
   - Scroll position and flags (for scroll events)

## How Replay Works

### Event Processing

The replay system processes events chronologically:

1. **Data Events** (`written`/`received`):
   - Write data directly to xterm.js terminal
   - Preserves all ANSI escape codes
   - Triggers terminal renders

2. **Scroll Events** (`scroll`):
   - Applies scroll position to xterm buffer
   - Synchronizes viewport position
   - Preserves user scroll intent flags

### Timing & Synchronization

- Events are sorted by timestamp before playback
- Delay between events is calculated from timestamp differences
- Playback speed multiplier adjusts delays
- Minimum 1ms delay ensures smooth rendering

### Memory Management

- Recording files are split every 1000 events to prevent OOM
- Events are stored in memory during playback
- No automatic recording (must be explicitly started)

## Architecture

### Components

**TerminalRecorder** (`src/renderer/utils/terminalRecorder.ts`)
- Singleton that captures terminal events
- Auto-saves files when reaching event threshold
- Records data and scroll events

**TerminalReplayPanel** (`src/renderer/panels/components/TerminalReplayPanel.tsx`)
- React component for playback UI
- Manages xterm.js instance
- Handles playback state and timing

### Data Flow

**Recording:**
```
node-pty process
  ↓
pty.onData() → IPC broadcast
  ↓
TerminalService.onData()
  ↓
terminal.write(data)
  ↓
terminalRecorder.recordDataWritten() ✓
```

**Replay:**
```
Load JSON file
  ↓
Parse & sort events
  ↓
Process event loop
  ↓
Apply to xterm.js
  ↓
Calculate next delay
  ↓
Schedule next event
```

## Integration Points

### Panel Registry

The replay panel is registered in:
- `src/shared/panels/repositoryPanelCatalog.ts` - Panel definition
- `src/renderer/panels/registry.tsx` - Panel renderer

### Recording Integration

To integrate recording controls into terminal panels:

```typescript
import { terminalRecorder } from '../../utils/terminalRecorder';

// Check if recording
const isRecording = terminalRecorder.isCurrentlyRecording();

// Get event count
const eventCount = terminalRecorder.getEventCount();

// Get output directory
const directory = terminalRecorder.getOutputDirectory();
```

## Use Cases

1. **Debugging Terminal Issues:**
   - Record terminal sessions with rendering problems
   - Replay to identify exact moment of issue
   - Inspect event details to find root cause

2. **Performance Analysis:**
   - Measure data write patterns
   - Identify scroll position changes
   - Analyze ANSI escape sequence usage

3. **Testing:**
   - Create reproducible test cases
   - Verify terminal rendering behavior
   - Test scroll synchronization

4. **Documentation:**
   - Record terminal demos
   - Share reproducible examples
   - Create training materials

## Future Enhancements

Potential improvements:

- [ ] Export to ASCIINEMA format
- [ ] Video export (GIF/MP4)
- [ ] Compression for storage efficiency
- [ ] Cursor position tracking
- [ ] Render timing metrics
- [ ] Playback bookmarks
- [ ] Event filtering/search
- [ ] Side-by-side comparison
- [ ] Recording UI in terminal header
- [ ] Auto-record on specific conditions
