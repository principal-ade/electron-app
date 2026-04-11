#!/bin/bash
# Principal IDE automated code analysis using OpenCode CLI
# Analyzes recent commits for improvement opportunities
# See docs/automated-code-analysis.md for setup and usage

set -e

REPO="/Users/griever/Developer/desktop-app/electron-app"
OPENCODE="$HOME/.opencode/bin/opencode"
ANALYSIS_PERIOD="7 days ago"
LOG_FILE="/tmp/principal-analysis-$(date +%Y-%m-%d-%H%M%S).log"

echo "=== Principal IDE Code Analysis ===" | tee "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "Repository: $REPO" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

cd "$REPO" || exit 1

# Get recent commits
echo "Fetching commits since $ANALYSIS_PERIOD..." | tee -a "$LOG_FILE"
COMMITS=$(git log --since="$ANALYSIS_PERIOD" --pretty=format:"%h - %s (%an)" --no-merges)

if [ -z "$COMMITS" ]; then
  echo "No new commits found. Exiting." | tee -a "$LOG_FILE"
  exit 0
fi

echo "Found commits:" | tee -a "$LOG_FILE"
echo "$COMMITS" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Get the commit SHA from 7 days ago
OLD_COMMIT=$(git log --since="$ANALYSIS_PERIOD" --pretty=format:"%H" | tail -1)

if [ -z "$OLD_COMMIT" ]; then
  # If no commits in period, use current HEAD
  OLD_COMMIT="HEAD"
fi

# Get changed files
CHANGED_FILES=$(git diff --name-only ${OLD_COMMIT}..HEAD 2>/dev/null | head -20)
echo "Changed files:" | tee -a "$LOG_FILE"
echo "$CHANGED_FILES" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run OpenCode analysis
echo "Running OpenCode analysis..." | tee -a "$LOG_FILE"
$OPENCODE run -m opencode/big-pickle "Analyze recent commits in the electron-app repository for improvement opportunities.

Time period: Last $ANALYSIS_PERIOD

Recent commits:
$COMMITS

Changed files (showing first 20):
$CHANGED_FILES

Please read a few of the most significant changed files and identify:
1. Performance improvements
2. Security vulnerabilities
3. Code quality issues
4. Architecture concerns
5. Testing gaps

Focus on the most impactful findings (top 3-5 issues). Be specific about file locations.
Keep the analysis concise and actionable.
" 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== Analysis Complete ===" | tee -a "$LOG_FILE"
echo "Finished at: $(date)" | tee -a "$LOG_FILE"
echo "Full log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
