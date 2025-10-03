# ACT Integration Progress Log

## Phase 1 (UI Foundations)

- Documented the UI integration plan inside `docs/ACT_INTEGRATION_DESIGN.md`, including the data retrieval strategy and component layout for the new Repository Actions panel.
- Implemented a renderer hook (`useRepositorySecretsStatus`) that verifies whether secrets are configured for a repository by delegating to `SecretsService.exists`.
- Added a dedicated `RepositoryActionsPanel` component that renders available workflow actions, surfaces the secrets status, and exposes "Configure"/"Run" affordances.
- Ensured the panel opens a confirmation prompt when "Run" is clicked (placeholder until the Act runner wiring is complete) and routes "Configure" clicks to the parent-provided handler.
- Established a self-contained folder layout (`components/` + `hooks/`) so the panel can be composed into `RepositoryDetailsPanel` without introducing coupling before the runner service lands.

Next phase will wire the panel into `RepositoryDetailsPanel`, connect the run confirmation to the real execution path, and hydrate the panel with workflow metadata from the forthcoming `ActWorkflowService`.

## Phase 2 (Runner Wiring Kickoff)

- Drafted the integration steps required to compose `RepositoryActionsPanel` into `RepositoryDetailsPanel`, including the prop additions (`actions`, `onConfigureSecrets`, `onRunAction`) and ensuring the existing repository summary layout remains unchanged behind a feature flag.
- Sketched the IPC surface for triggering runs by defining a `runRepositoryAction` channel that forwards `{ repoId, workflowPath, actionId }` to the main-process `ActRunnerService`, paving the way for the confirmation dialog to dispatch real executions.
- Captured the data contract for a minimal `ActWorkflowService` stub that can provide workflow metadata (id, name, description, workflowPath, requiresSecrets) so the panel can hydrate itself without hard-coded fixtures.
- Identified validation hooks needed before executing an action (secrets present, act binary installed) and noted they will be surfaced in the confirmation flow as part of this phase.
- Documented outstanding dependencies (runner service scaffolding, secure secret file management) so coordination with the main-process team can happen before the wiring lands.
- Wired the `RepositoryActionsPanel` into `RepositoryDetailsPanel` behind the `PLASMA_ENABLE_ACT_INTEGRATION` feature flag, hydrated by the new renderer-side `ActWorkflowService`, and surfaced refined loading/error states while workflows are discovered.
- Added shared ACT integration types alongside renderer/main-process service wrappers and IPC handlers so run confirmations now dispatch through `ActRunnerService` (currently stubbed) after validating prerequisites.
