# Storage namespaces — mapping to UI features

This document lists the storage namespaces registered by the app, groups them by whether renderer UI depends on them, and provides code evidence links you can inspect.

## Where namespaces are defined
- Canonical enums: [`src/shared/types/namespaces.types.ts:12`](src/shared/types/namespaces.types.ts:12)  
- Runtime registry (descriptions + providers): [`src/main/storage-providers/typed-namespaces.ts:349`](src/main/storage-providers/typed-namespaces.ts:349)  
- Helper to list at runtime: [`src/main/storage-providers/all-namespaces.ts:41`](src/main/storage-providers/all-namespaces.ts:41)

---

## Namespaces used directly by renderer UI

- user-preferences — "User preferences and settings" (provider: electron-store)  
  - Registered in runtime registry: [`src/main/storage-providers/typed-namespaces.ts:359`](src/main/storage-providers/typed-namespaces.ts:359)  
  - Read/edited by settings modal: [`src/renderer/components/landing-page/SettingsModal.tsx:897`](src/renderer/components/landing-page/SettingsModal.tsx:897)  
  - Renderer IPC wrapper: [`src/renderer/main-process-api/UserPreferencesService.ts:12`](src/renderer/main-process-api/UserPreferencesService.ts:12)

- repositories — "Repository configurations and metadata" (provider: electron-store)  
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:367`](src/main/storage-providers/typed-namespaces.ts:367)  
  - Landing page / repo lists: [`src/renderer/pages/LandingPage/LandingPage.tsx:61`](src/renderer/pages/LandingPage/LandingPage.tsx:61)  
  - Repo manager & switcher: [`src/renderer/repo-manager/RepositoryManager.tsx:339`](src/renderer/repo-manager/RepositoryManager.tsx:339), [`src/renderer/repo-manager/shared/RepositorySwitcherModal.tsx:33`](src/renderer/repo-manager/shared/RepositorySwitcherModal.tsx:33)

- agent-sessions — "Agent session data with flat event list" (provider: electron-store)
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:389`](src/main/storage-providers/typed-namespaces.ts:389)
  - Session details UI: [`src/renderer/components/agent-overview/SessionDetailsPanel.tsx:135`](src/renderer/components/agent-overview/SessionDetailsPanel.tsx:135) (AgentSessionsTab retired)
  - Archiving writes session summaries: [`src/main/agent-sessions/AgentSessionArchivingService.ts:212`](src/main/agent-sessions/AgentSessionArchivingService.ts:212)

- secrets-metadata — "Metadata for encrypted secrets" (provider: electron-store)  
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:251`](src/main/storage-providers/typed-namespaces.ts:251)  
  - Secrets UI (store secret): [`src/renderer/repo-manager/shared/SecretsModal.tsx:103`](src/renderer/repo-manager/shared/SecretsModal.tsx:103)  
  - Main manager/tests: [`src/main/stores/SecretManager.ts:228`](src/main/stores/SecretManager.ts:228)

- cache / temp (memory-backed) — in-memory caches the renderer relies on for performance (not persisted)  
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:399`](src/main/storage-providers/typed-namespaces.ts:399) and [`src/main/storage-providers/typed-namespaces.ts:406`](src/main/storage-providers/typed-namespaces.ts:406)  
  - File-tree / analysis caches: [`src/renderer/services/FileTreeCacheService.ts:38`](src/renderer/services/FileTreeCacheService.ts:38)  
  - Renderer listens for invalidation events: [`src/renderer/repo-manager/RepositoryManager.tsx:606`](src/renderer/repo-manager/RepositoryManager.tsx:606)  
  - Store Viewer shows cache categories: [`src/renderer/pages/StoreViewer.tsx:406`](src/renderer/pages/StoreViewer.tsx:406)

- session-summaries & global-session-registry — backing data for session UIs and quick summaries  
  - Types/registry: [`src/main/storage-providers/typed-namespaces.ts:241`](src/main/storage-providers/typed-namespaces.ts:241)  
  - Written during archiving: [`src/main/agent-sessions/AgentSessionArchivingService.ts:212`](src/main/agent-sessions/AgentSessionArchivingService.ts:212)

---

## Namespaces primarily main-only (no renderer usage found)

- ai-configuration — "AI provider configurations and settings" (provider: electron-store)  
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:374`](src/main/storage-providers/typed-namespaces.ts:374)  
  - LLM API surface: [`src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48`](src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48)  
  - I did not find direct renderer files reading this namespace in the codebase search.

- llm-models — "LLM model configurations and custom models" (provider: electron-store)  
  - Registered: [`src/main/storage-providers/typed-namespaces.ts:381`](src/main/storage-providers/typed-namespaces.ts:381)  
  - API: [`src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48`](src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48)

- agent-event-indexes and per-agent event namespaces (claude-hook-events, opencode-hook-events, cline-hook-events) — raw agent event stores (main-managed)  
  - Enums: [`src/shared/types/namespaces.types.ts:38`](src/shared/types/namespaces.types.ts:38)  
  - Registered typing: [`src/main/storage-providers/typed-namespaces.ts:254`](src/main/storage-providers/typed-namespaces.ts:254)  
  - UI surfaces consume processed session data (agent-sessions) not raw event files.

- mcp-bridge-data — MCP bridge entries; used by MCP server in main, not rendered in UI components I found  
  - Store implementation: [`src/main/stores/MCPBridgeDataStore.ts:80`](src/main/stores/MCPBridgeDataStore.ts:80)  
  - MCP server tool: [`src/main/mcp-app-control/mcp-server.ts:250`](src/main/mcp-app-control/mcp-server.ts:250)

- docker-containers / docker-sessions — Docker/tool state/backing used by Docker services in main only  
  - Docker store service: [`src/main/docker/DockerStoreService.ts:11`](src/main/docker/DockerStoreService.ts:11)  
  - Optimized Docker: [`src/main/docker/OptimizedDockerService.ts:26`](src/main/docker/OptimizedDockerService.ts:26)

- archive-configuration — archive settings used by main archiving services; no direct settings UI found for editing this namespace in renderer  
  - Typing: [`src/main/storage-providers/typed-namespaces.ts:243`](src/main/storage-providers/typed-namespaces.ts:243)  
  - Used by archiver: [`src/main/agent-sessions/AgentSessionArchivingService.ts:212`](src/main/agent-sessions/AgentSessionArchivingService.ts:212)

---

## Recommendations
1. Treat "Main-only" namespaces as candidates to be labeled/flagged in the runtime registry (add `mainOnly: true` metadata) before removal. Registry location: [`src/main/storage-providers/typed-namespaces.ts:349`](src/main/storage-providers/typed-namespaces.ts:349)  
2. If you plan to remove any namespace, run a final renderer-only grep to confirm no references; the helper to get all namespaces: [`src/main/storage-providers/all-namespaces.ts:41`](src/main/storage-providers/all-namespaces.ts:41)  
3. For ambiguous cases (ai-configuration, llm-models), inspect the LLMModels API and any admin/settings UI that may be added later: [`src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48`](src/shared/main-process-api-interfaces/LLMModelsAPI.ts:48)

## Next steps I can take
- Produce a renderer-only per-namespace reference list (full file-by-file grep) formatted as a table or CSV.  
- Insert `mainOnly` flags or deprecation comments into the registry for the namespaces you want to deprecate (I can create a PR).

Document created from code search results; inspect the linked files for the exact lines and usages above.