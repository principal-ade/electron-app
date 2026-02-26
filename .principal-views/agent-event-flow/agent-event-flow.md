# Agent Event Flow

The Agent Event Flow system handles real-time propagation of agent session events from the utility process through the main process to renderer windows for visualization.

## What Problem Does This Solve?

When agents execute tasks, they generate events (tool calls, responses, errors) that need to be displayed in the UI in real-time. This system provides:

- **Real-time event streaming** from background processes to UI
- **Multi-window broadcast** so all open windows see the same events
- **Session state management** with in-memory caching
- **Decoupled architecture** separating event generation from consumption

## Architecture Overview

### Process Flow

1. **Utility Process**: Event Processing Server receives raw agent events
2. **Main Process**: EventServerManager processes and caches events, broadcasts to all windows
3. **Renderer Process**: React contexts and services consume events for UI updates

### Key Components

- **EventServerManager**: Central hub that receives events and emits to listeners
- **SessionCache**: In-memory store for session state
- **AgentHighlightContext**: React context providing events to UI components
- **EventHighlightService**: Processes events for Code City visualization

## Design Decisions

### Why Broadcast to All Windows?

Events are broadcast to all windows using `webContents.send()` rather than targeted messaging. This ensures:
- Any window can display agent activity
- New windows immediately receive current state
- Simplified routing logic

### Why Use EventEmitter Pattern?

The EventServerManager uses Node's EventEmitter for:
- Loose coupling between event sources and consumers
- Easy subscription management
- Native async event handling

## Common Workflows

1. **Agent starts task**: Event flows through pipeline, UI shows activity indicator
2. **Tool execution**: Each tool call generates events displayed in session view
3. **Session completion**: Final state cached, available for replay
