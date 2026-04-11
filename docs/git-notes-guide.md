# Git Notes Guide

## Overview

Git notes allow you to attach metadata to existing commits without changing their SHA. This is useful for adding annotations, review comments, or other metadata after the fact without rewriting history.

## Basic Usage

### Adding Notes

```bash
# Add a note to a specific commit
git notes add -m "Additional metadata here" <commit-sha>

# Add a note to the current HEAD
git notes add -m "Some note"

# Add a note interactively (opens editor)
git notes add <commit-sha>
```

### Viewing Notes

```bash
# View commit log with notes
git log --show-notes

# View a specific note
git notes show <commit-sha>

# List all notes
git notes list
```

### Editing and Removing Notes

```bash
# Edit an existing note
git notes edit <commit-sha>

# Remove a note
git notes remove <commit-sha>

# Copy notes from one commit to another
git notes copy <from-commit> <to-commit>
```

## Syncing Notes

**IMPORTANT**: Notes are NOT pushed or fetched by default with regular `git push` and `git fetch` commands.

### Manual Push/Fetch

```bash
# Push notes to remote
git push origin refs/notes/*

# Fetch notes from remote
git fetch origin refs/notes/*:refs/notes/*
```

### Automatic Push/Fetch Configuration

Configure Git to always sync notes:

```bash
# Always push notes with regular pushes
git config --add remote.origin.push '+refs/notes/*:refs/notes/*'

# Always fetch notes with regular fetches
git config --add remote.origin.fetch '+refs/notes/*:refs/notes/*'
```

## Checking Sync Status

### Check for Unpushed Notes

```bash
# See local notes not on remote
git log origin/refs/notes/commits..refs/notes/commits

# Empty output = everything is synced
```

### Check for Unfetched Notes

```bash
# First, update remote refs
git fetch origin

# See remote notes you don't have locally
git log refs/notes/commits..origin/refs/notes/commits

# Empty output = you have everything
```

### View All Note Refs

```bash
# Show all local note refs
git show-ref | grep refs/notes

# Show remote note refs
git ls-remote origin refs/notes/*
```

### Combined Sync Check

```bash
# Check both directions at once
git fetch origin refs/notes/*:refs/remotes/origin/notes/* && \
echo "=== Notes you need to push ===" && \
git log --oneline origin/notes/commits..refs/notes/commits && \
echo "=== Notes you need to fetch ===" && \
git log --oneline refs/notes/commits..origin/notes/commits
```

## Merge Conflicts

When multiple people add notes to the same commit, you may encounter merge conflicts.

### Default Behavior (Manual Merge)

```bash
# Fetch notes (may trigger conflict)
git fetch origin refs/notes/*:refs/notes/*

# If conflict occurs, resolve in:
# .git/NOTES_MERGE_WORKTREE/

# After resolving, finalize:
git notes merge --commit

# Or abort:
git notes merge --abort
```

### Automatic Merge Strategies

Configure Git to automatically resolve note conflicts:

```bash
# Use a specific strategy for this merge
git notes merge -s <strategy>

# Set default strategy
git config notes.mergeStrategy <strategy>
```

Available strategies:

- **`manual`** (default) - Stop and require manual resolution
- **`ours`** - Keep local notes, discard remote
- **`theirs`** - Discard local notes, keep remote
- **`union`** - Concatenate both notes together
- **`cat_sort_uniq`** - Concatenate, sort, and deduplicate lines

### Recommended Strategy for Teams

For team collaboration where multiple people may annotate the same commit:

```bash
# Use union to combine all notes
git config notes.mergeStrategy union
```

## GitHub Support

**GitHub does NOT display git notes in their web interface.**

- Notes can be pushed to and fetched from GitHub
- They are stored in the repository
- However, they are invisible in the GitHub UI
- Other platforms like Sourcehut do support displaying notes

### Alternatives for GitHub

If you need visible metadata on GitHub, use:

1. **Pull Request descriptions/comments** - Rich metadata in UI
2. **Commit message conventions** - Like conventional commits
3. **Annotated tags** - For milestones/releases
4. **GitHub Issues/Projects** - Link commits to issues

## Use Cases for Teams

Despite GitHub limitations, notes can be useful for:

### Advantage: Independent of HEAD

Since notes don't affect commit SHAs or HEAD position, they can be:
- Synced without disrupting developers' working trees
- Updated without requiring rebases or force pushes
- Managed as a separate metadata layer alongside the repo

### Practical Applications

1. **Code review metadata** - Track review status, reviewers, approval timestamps
2. **Build/CI results** - Annotate commits with test results, performance metrics
3. **Security scanning** - Add vulnerability scan results to commits
4. **Deployment tracking** - Note when/where commits were deployed
5. **Quality metrics** - Attach code quality scores, coverage data

## Automation Examples

### Pre-Push Hook

Automatically push notes with commits:

```bash
#!/bin/bash
# .git/hooks/pre-push

# Push notes after commits
git push origin refs/notes/*
```

### Post-Fetch Hook

Automatically fetch notes after pulling:

```bash
#!/bin/bash
# .git/hooks/post-fetch

# Fetch notes after commits
git fetch origin refs/notes/*:refs/notes/*
```

### CI/CD Integration

```bash
# In CI pipeline, add build results as notes
git notes add -m "Build #${BUILD_ID}: ${BUILD_STATUS}\nTests: ${TEST_RESULTS}" ${COMMIT_SHA}
git push origin refs/notes/*
```

## Advanced Usage

### Note Namespaces

Notes can be organized into different namespaces:

```bash
# Add note to custom namespace
git notes --ref=reviews add -m "Approved by Alice" <commit-sha>

# View notes from specific namespace
git log --notes=reviews

# Push specific namespace
git push origin refs/notes/reviews
```

### Common Namespaces

- `refs/notes/commits` - Default namespace
- `refs/notes/reviews` - Code review metadata
- `refs/notes/builds` - Build information
- `refs/notes/deploys` - Deployment tracking

## Best Practices

1. **Set up automatic syncing** if your team uses notes
2. **Use union merge strategy** to avoid conflicts
3. **Document your note format** for consistency
4. **Use namespaces** to organize different types of metadata
5. **Automate note creation** via hooks or CI/CD
6. **Don't rely on GitHub UI** - notes won't be visible there
7. **Keep notes concise** - they're meant for metadata, not documentation

## References

- [Git Notes Official Documentation](https://git-scm.com/docs/git-notes)
- [Git Notes: git's coolest, most unloved feature](https://tylercipriani.com/blog/2022/11/19/git-notes-gits-coolest-most-unloved-feature/)
