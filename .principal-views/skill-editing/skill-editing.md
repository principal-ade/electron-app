# Skill Editing with GitHub API Commits

## Overview

This storyboard maps the telemetry for the skill editing feature, which enables users to edit installed skills directly in the app and commit changes to GitHub without cloning repositories locally.

## Feature Description

When a user has an installed skill from a GitHub repository where they have push permission, they can:

1. Click the "Edit" button in the skill browser
2. Edit skill files using MDXEditorPanel (for markdown) or FileEditorPanel (for code)
3. Commit changes directly to GitHub via the Contents API
4. Receive notifications when upstream skill repositories are updated via webhooks

## User Flow

### 1. Permission Check
- When user selects an installed skill, the app checks if they have push permission
- Uses cached permissions (5-minute TTL) to avoid excessive API calls
- If no permission, Edit button is hidden

### 2. Opening the Editor
- User clicks "Edit" button
- Modal opens with three-panel layout:
  - **Left**: File tree showing all skill files
  - **Center**: MDXEditorPanel or FileEditorPanel based on file type
  - **Right**: Commit panel with message input

### 3. Editing Files
- User selects a file from the tree
- File content loads in the appropriate editor
- Changes are tracked with dirty state
- No local git operations - files are edited in memory

### 4. Committing Changes
- User enters commit message
- Click "Commit to GitHub" button
- GitHub Contents API (PUT /repos/{owner}/{repo}/contents/{path}) commits directly
- On success:
  - Local file is updated
  - Skill lock file is updated with new commit SHA
  - Dirty state is cleared

### 5. Webhook Notifications
- When push events occur on skill repositories
- FastForwardService checks if any installed skills are affected
- Creates notifications for users with those skills installed
- Users can see updates in the mailbox and choose to update

## Key Components

### Main Process
- **SkillPermissionService**: Checks and caches repository permissions
- **skillEditingHandlers.ts**: IPC handlers for file operations and commits
- **FastForwardService**: Processes webhooks and creates update notifications
- **GitHub repository.ts**: Contains `commitFile()` and `getFileContentWithSha()` functions

### Renderer Process
- **SkillEditorModal**: Three-panel editor interface
- **SkillBrowserView**: Integrates Edit button and permission checking
- **InstallSkillToolbar**: Shows Edit button when user has permission

## Telemetry Events

### Edit Flow
1. `skill.permission.checked` - Permission validation
2. `skill.editor.opened` - Modal opened
3. `skill.file.loaded` - File selected and loaded
4. `skill.file.edited` - User makes changes
5. `skill.commit.started` - User clicks commit
6. `github.api.commit.request` - PUT request to GitHub
7. `github.api.commit.response` - Response from GitHub
8. `skill.file.updated` - Local file written
9. `skill.lock.updated` - Lock file updated with new SHA

### Webhook Flow
1. `webhook.github.push.received` - Push event from GitHub
2. `skill.update.checked` - Check if affects installed skills
3. `skill.update.notification.created` - Create notification for affected skills

## Correlation

Events are correlated using:
- **session.id**: Links all events in a single editing session
- **skill.name**: Identifies which skill is being edited
- **webhook.delivery.id**: Links webhook events to notifications

## Success Validation

A successful edit is confirmed when:
1. `skill.commit.started` exists
2. `github.api.commit.response` exists with `success=true`
3. `skill.file.updated` exists
4. `skill.lock.updated` exists
5. All events have the same `session.id` and `skill.name`
6. `commit.sha` matches across events
7. All events occur within a 5-second window

## Error Scenarios

### Permission Denied
- `skill.permission.checked` has `has.permission=false`
- Edit button is hidden from UI
- No editor is opened

### Concurrent Edit (409 Conflict)
- `github.api.commit.response` has:
  - `success=false`
  - `http.status_code=409`
  - `error.type=conflict`
- User sees error message suggesting to refresh and try again
- Local changes are preserved

### Network Error
- `github.api.commit.response` has:
  - `success=false`
  - `http.status_code=0`
  - `error.type=network`
- User sees retry option
- Content is saved locally but not committed to GitHub

## Implementation Details

### GitHub API Commit Flow
1. Get current file SHA from GitHub (if file exists)
2. Base64 encode new content
3. PUT to `/repos/{owner}/{repo}/contents/{path}` with:
   - `message`: Commit message
   - `content`: Base64-encoded content
   - `sha`: Current file SHA (for updates)
   - `branch`: Target branch
4. On success, extract new `commit.sha` from response
5. Write content to local file at `~/.agents/skills/{skillName}/{filePath}`
6. Update `~/.agents/.skill-lock.json` with `lastEditCommitSha`

### Permission Caching
- Repository permissions are cached for 5 minutes
- Prevents excessive API calls on repeated skill selections
- Cache is invalidated on 403 errors
- Service: `SkillPermissionService`

### Webhook Processing
- WebSocket connection receives `webhook:github_event` messages
- FastForwardService handles all webhook events
- For push events, checks lock file for matching repositories
- Creates one notification per affected skill
- Notifications appear in FastForward mailbox

## References

### Source Files
- `src/main/services/SkillPermissionService.ts`
- `src/main/skills/skillEditingHandlers.ts`
- `src/main/services/FastForwardService.ts`
- `src/main/version-control-providers/github/repository.ts`
- `src/renderer/principal-window/views/SkillBrowserView/SkillEditorModal.tsx`
- `src/renderer/principal-window/views/SkillBrowserView/SkillBrowserView.tsx`

### Related Storyboards
- `skill-installation` - Installing skills from GitHub repositories
- `git-sync` - Git synchronization and webhook infrastructure
