# Repository Discovery & Auto-Registration Telemetry

This document describes the telemetry events emitted during repository discovery and automatic registration in Alexandria.

## What Problem Does This Solve?

When scanning a base directory for git repositories, we need telemetry to:

- **Monitor discovery performance** - How long does scanning take? How many repos found?
- **Validate auto-registration** - Did all discovered repos get registered successfully?
- **Debug registration failures** - Which repos failed and why?
- **Track metadata enrichment** - Are GitHub repos getting their metadata cached?
- **Correlate the full workflow** - From discovery → registration → metadata fetch

## Telemetry Events

### Discovery Phase

**1. `alexandria.discovery.started`**
- Emitted when base directory scanning begins
- Attributes: `base_directory`, `max_depth`, `scan_id`
- Purpose: Marks the start of discovery workflow

**2. `alexandria.discovery.repo_found`**
- Emitted for each git repository discovered
- Attributes: `repo_path`, `repo_name`, `scan_id`, `is_tracked`
- Purpose: Tracks individual repo discoveries

**3. `alexandria.discovery.completed`**
- Emitted when scanning finishes
- Attributes: `scan_id`, `total_repos_found`, `untracked_repos_count`, `duration_ms`
- Purpose: Provides summary statistics for discovery

### Auto-Registration Phase

**4. `alexandria.registration.batch_started`**
- Emitted when auto-registration begins for discovered repos
- Attributes: `scan_id`, `repos_to_register`
- Purpose: Marks start of batch registration

**5. `alexandria.registration.repo_registered`**
- Emitted for each successful registration
- Attributes: `repo_name`, `repo_path`, `scan_id`, `remote_url`, `is_github`
- Purpose: Confirms individual repo registration

**6. `alexandria.registration.repo_failed`**
- Emitted when registration fails
- Attributes: `repo_name`, `repo_path`, `scan_id`, `error_message`, `error_type`
- Purpose: Captures registration failures for debugging

**7. `alexandria.registration.batch_completed`**
- Emitted when batch registration finishes
- Attributes: `scan_id`, `success_count`, `failure_count`, `duration_ms`
- Purpose: Provides summary of registration results

### Metadata Enrichment Phase

**8. `alexandria.metadata.fetch_started`**
- Emitted when GitHub metadata fetch begins
- Attributes: `repo_name`, `github_owner`, `github_repo`
- Purpose: Tracks metadata enrichment initiation

**9. `alexandria.metadata.fetch_completed`**
- Emitted when metadata is successfully cached
- Attributes: `repo_name`, `default_branch`, `has_metadata`, `duration_ms`
- Purpose: Confirms metadata is available (including `defaultBranch` for branch analysis)

## Event Correlation

All events in a single discovery workflow share the same `scan_id` attribute, enabling:

```sql
-- Get full workflow for a scan
SELECT event_name, attributes
FROM events
WHERE attributes['scan_id'] = '<scan-id>'
ORDER BY timestamp;
```

## Success Validation

To validate that discovery and auto-registration worked correctly:

```sql
-- Check all discovered repos were processed
SELECT
  d.scan_id,
  d.attributes['total_repos_found'] as found,
  r.attributes['success_count'] + r.attributes['failure_count'] as processed
FROM events d
JOIN events r ON d.attributes['scan_id'] = r.attributes['scan_id']
WHERE d.event_name = 'alexandria.discovery.completed'
  AND r.event_name = 'alexandria.registration.batch_completed';
```

Expected: `found = processed` (all discovered repos were attempted for registration)

## Error Scenarios

Common registration failures captured in `alexandria.registration.repo_failed`:

| Error Type | Cause | Resolution |
|------------|-------|------------|
| `PERMISSION_DENIED` | Can't read .git directory | Check file permissions |
| `NO_GIT_DIR` | Missing .git folder | Not a valid git repo |
| `ALREADY_REGISTERED` | Duplicate entry | Skip (already tracked) |
| `REMOTE_FETCH_FAILED` | Can't read git remote | Non-fatal, continues |

## Implementation Status

**Current Status:** Draft (telemetry not yet implemented)

This canvas documents the *planned* telemetry structure for the repository discovery and auto-registration feature. The actual event emission needs to be implemented in:
- `src/renderer/contexts/ProjectsPanelContext.tsx` - Discovery + registration logic
- `src/main/file-system/gitRepositoryScannerService.ts` - Scanning service
- `src/main/stores/AlexandriaRegistryService.ts` - Registration service
