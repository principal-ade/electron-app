# Scripts Directory

This directory contains automation scripts for Principal IDE development.

## Available Scripts

### `analyze-commits.sh`

Automated code analysis using OpenCode CLI. Analyzes recent commits and identifies improvement opportunities.

**Documentation**: See [../docs/automated-code-analysis.md](../docs/automated-code-analysis.md)

**Quick start**:
```bash
./scripts/analyze-commits.sh
```

**Setup cron schedule**:
```bash
# Daily at 9 AM
0 9 * * * /Users/griever/Developer/desktop-app/electron-app/scripts/analyze-commits.sh
```
