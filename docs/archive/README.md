# Documentation Archive

This folder contains completed migration documentation and historical implementation plans that are no longer actively needed but may be useful for reference.

## Contents

### Completed Git Migrations
- **GIT_MIGRATION_COMPLETE.md** - Migration from exec to electron-cli-bridge (Completed 2025-09-11)
- **GIT_MIGRATION_PLAN.md** - Original plan (superseded by COMPLETE doc)
- **GIT_WATCHER_MIGRATION_COMPLETE.md** - Migration to RepositoryMonitoringService (Completed 2025-01-26)
- **GIT_WATCHER_MIGRATION_PLAN.md** - Original plan (superseded by COMPLETE doc)
- **MIGRATION-TO-GIT-SYNC.md** - General git sync migration
- **MIGRATION_IMPLEMENTATION.md** - Implementation details

### Completed Architecture Migrations
- **CONTEXT_MIGRATION_COMPLETE.md** - Context-based architecture migration (Completed 2025-10-07)
  - HighlightLayersContext implementation
  - FileTreePanelContent creation
  - Eliminated prop drilling

## Archive Policy

Documents are moved to this archive when:
1. The migration/implementation is 100% complete
2. The work has been verified and tested
3. A "COMPLETE" document exists (for migrations)
4. The document is no longer needed for active development

## Retention

Archived documents are kept for historical reference and may be permanently deleted after:
- 6 months for completed migrations
- 1 year for major architecture changes
- When team consensus determines they're no longer useful

## Finding Active Documentation

For current, active documentation, see the main `/docs` folder.
