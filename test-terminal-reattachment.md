# Terminal Reattachment Test Plan

## Test Scenarios

### 1. First Time Opening Terminal for Agent Session
- Click terminal button for an agent session that has never had a terminal
- **Expected**: Creates new terminal tab with `claude -r <sessionId>` command

### 2. Click Terminal Button Again (Tab Still Open)
- With terminal tab still open, click terminal button again for same agent session
- **Expected**: Switches to existing tab, does NOT create new tab

### 3. Close Tab, Then Reopen
- Close the terminal tab (X button on tab)
- Click terminal button again for same agent session
- **Expected**: Creates new tab (since we destroyed the terminal when closing)

### 4. Switch Views, Then Come Back
- Open terminal for agent session
- Switch to a different view (e.g., Architecture tab)
- Switch back to Agent Sessions
- Click terminal button
- **Expected**: Switches to existing tab (terminal persisted in background)

### 5. Terminal Created Outside Tab System
- Start a terminal session via other means
- Agent session should track it
- Click terminal button
- **Expected**: Creates tab that reattaches to existing terminal session

## Implementation Details

The system now:
1. **First checks** if a tab already exists for the agent session ID
   - If yes → switches to that tab
   
2. **Then checks** if the agent session has an active terminal in backend
   - Gets agent session data
   - Looks for terminal sessions with status='active'
   - Verifies terminal still exists in backend
   - If yes → creates new tab but reattaches to existing terminal (no new command)
   
3. **Finally** creates new terminal if neither condition is met
   - Creates new tab with `claude -r <sessionId>` command

## Key Benefits
- Prevents duplicate terminals for same agent session
- Preserves terminal state when switching between tabs
- Reuses existing terminal sessions when possible
- Prevents hitting the 10-session limit unnecessarily