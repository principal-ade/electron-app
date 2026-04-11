# Automated Code Analysis with OpenCode

This document describes the automated code analysis system for Principal IDE using OpenCode CLI.

## Overview

We use OpenCode CLI to automatically analyze recent commits and identify improvement opportunities across the codebase. The system runs on a schedule (via cron or launchd) and analyzes code changes for:

- Performance improvements
- Security vulnerabilities
- Code quality issues
- Architecture concerns
- Testing gaps

## Architecture

```
┌─────────────────┐
│  Cron/Launchd   │
│   Scheduler     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ analyze-commits.sh              │
│ - Gets recent commits           │
│ - Identifies changed files      │
│ - Calls OpenCode CLI            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ OpenCode CLI                    │
│ - Analyzes code changes         │
│ - Uses big-pickle model         │
│ - Reads full files for context  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Analysis Output                 │
│ - Findings saved to log file    │
│ - Can integrate with Memory     │
│   Palace via MCP                │
└─────────────────────────────────┘
```

## Setup

### 1. Script Location

The analysis script is located at:
```
scripts/analyze-commits.sh
```

### 2. Configuration

Edit the script to configure:

```bash
# Repository to analyze
REPO="/Users/griever/Developer/desktop-app/electron-app"

# OpenCode installation path
OPENCODE="$HOME/.opencode/bin/opencode"

# Time period to analyze
ANALYSIS_PERIOD="7 days ago"

# Model to use (OpenCode Zen)
MODEL="opencode/big-pickle"
```

### 3. Schedule with Cron

Daily analysis at 9 AM:
```bash
crontab -e
# Add this line:
0 9 * * * /Users/griever/Developer/desktop-app/electron-app/scripts/analyze-commits.sh
```

Weekly analysis on Monday at 9 AM:
```bash
0 9 * * 1 /Users/griever/Developer/desktop-app/electron-app/scripts/analyze-commits.sh
```

### 4. Schedule with launchd (macOS - Recommended)

Create `~/Library/LaunchAgents/com.principal-ide.code-analysis.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.principal-ide.code-analysis</string>

    <key>ProgramArguments</key>
    <array>
        <string>/Users/griever/Developer/desktop-app/electron-app/scripts/analyze-commits.sh</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/principal-analysis.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/principal-analysis.error.log</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.principal-ide.code-analysis.plist
```

## Usage

### Manual Run

```bash
./scripts/analyze-commits.sh
```

### View Logs

```bash
# Most recent analysis
ls -t /tmp/principal-analysis-*.log | head -1 | xargs cat

# Or if using launchd
tail -f /tmp/principal-analysis.log
```

## Analysis Output

The script generates structured output with:

1. **Summary table** of top issues prioritized by impact
2. **Specific file locations** and line numbers
3. **Actionable recommendations** for each finding
4. **Quick wins** - easy fixes that provide immediate value

Example output:
```
| Priority | Issue | Location | Recommendation |
|----------|-------|----------|---------------|
| **1** | Cache serves stale data | file.ts:31 | Invalidate cache on push events |
| **2** | No payload size limits | api.ts:661 | Cap arrays at 100 items |
```

## Integration with Memory Palace

To store findings in Memory Palace, add to the OpenCode prompt:

```bash
"After identifying issues, store findings using:
- mcp__principal-mcp__add_memory_note
- Anchor notes to specific file paths
- Tag with: 'code-review', 'automated-analysis', and issue type"
```

## Model Selection

Current model: `opencode/big-pickle` (free, stealth model from OpenCode Zen)

Alternative models:
- `opencode/claude-sonnet-4-5` - More thorough, costs $3-15/1M tokens
- `opencode/gpt-5.3-codex` - Code-focused, costs $1.75/1M tokens
- `opencode/claude-opus-4-5` - Most capable, costs $5-25/1M tokens

See [OpenCode Zen docs](https://opencode.ai/docs/zen) for full model list.

## Analysis Scope

The script analyzes:
- Commits from the last 7 days (configurable)
- Up to 20 most significant changed files
- Full file content (not just diffs) for proper context
- Multiple aspects: performance, security, quality, architecture, testing

## Limitations

1. **One-shot execution**: Cannot be continued with `opencode --continue`
2. **No interactive feedback**: Runs unattended
3. **Context per run**: Each run starts fresh (unless using Memory Palace)
4. **Git history dependent**: Only analyzes committed changes

## Troubleshooting

### Cron not running
- Check cron has Full Disk Access: System Settings → Privacy & Security → Full Disk Access → Add `/usr/sbin/cron`
- Check cron logs: `grep CRON /var/log/system.log`

### Model not found
- Ensure you've connected to OpenCode Zen: `opencode` then `/connect`
- Verify model name format: `opencode/<model-id>`

### No commits found
- Adjust `ANALYSIS_PERIOD` in the script
- Check git log works: `git log --since="7 days ago"`

## Future Enhancements

Potential improvements:
- Multi-repository support (loop through repos)
- Integration with CI/CD for PR-based analysis
- Memory Palace integration for persistent findings
- Slack/Discord notifications for critical issues
- Dashboard for tracking improvement trends over time

## References

- OpenCode CLI: https://opencode.ai
- OpenCode Zen Models: https://opencode.ai/docs/zen
- Cron syntax: https://crontab.guru
- launchd documentation: `man launchd.plist`
