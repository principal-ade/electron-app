# Electron app security follow-ups

Status: **open follow-ups** — captured 2026-06-01 during the "Investigating Web-ade Auth"
review (topic `topic-1779510063456-5dwl9ycjw`). None of these are confirmed exploited.
They are recorded here so they can be picked up later without re-deriving them.

## Context

This review extended the web-ade / auth-server auth investigation into the desktop
client (`principal-ade` electron app), biased toward the auth/token surface.

**Baseline is good.** Every `BrowserWindow` runs `nodeIntegration:false` +
`contextIsolation:true`, preloads use `contextBridge`, OAuth uses PKCE, tokens live in
the OS keychain via Electron `safeStorage` (`src/main/services/UnifiedSecureStorage.ts`),
and a CSP is injected on `onHeadersReceived`.

**Auth-server disclosure follow-up resolved here.** The electron client calls the
(previously vulnerable) `/api/auth/token/current` on every token sync via
`OAuthServerClient.fetchCurrentToken` (`src/main/services/OAuthServerClient.ts:346-408`),
pointed at production `https://auth.principal-ade.com`
(`src/shared/config/appBranding.ts:11-13`). This confirms the pre-patch disclosure was
internet-reachable, not LAN-only — so the `91894ff` server hardening was load-bearing.
The electron client itself behaves correctly: it sends its *own* valid `github_token` as
the Bearer plus the `github_user_id`, so it was only ever the legitimate consumer.

## Follow-up items

Most of these are low-risk *today* because the renderer runs trusted first-party
content. They would matter if attacker-controlled content ever reached a renderer
(e.g. via the localhost CSP bypass + `webviewTag`).

1. **`AUTH_SERVER_URL` env override is a token-exfil lever.**
   `OAuthServerClient` resolves `process.env.AUTH_SERVER_URL || PRODUCTION` and ships the
   bearer GitHub token to whatever that points at. Env control ≈ already compromised, so
   low severity, but worth noting.
   - `src/main/services/OAuthServerClient.ts:62-67`
   - `src/main/services/AuthService.ts:708-712`

2. **Arbitrary file-write IPC with no base-path containment.**
   `FileSystemAPIEvent.WRITE_FILE` → `fileSystemAdapter.writeFile` writes to ANY
   renderer-supplied path and `mkdir -p`s parents. Becomes serious only if untrusted
   content reaches a renderer (then it's persistence/RCE-adjacent).
   - `src/main/file-system/fileSystemHandlers.ts:156-183` (the write)
   - `src/main/file-system/fileSystemHandlers.ts:1229-1247` (the IPC handler)

3. **`shell.openExternal` validates URL *format* but not *scheme*.**
   Arbitrary schemes can trigger local protocol handlers. Gated by `validateSource`
   (sender must be `file://`/localhost), but that check uses a loose
   `url.includes("localhost:1212")`.
   - `src/main/stores/linksHandlers.ts:271-278` (openExternal)
   - `src/main/stores/linksHandlers.ts:322-336` (validateSource)

4. **`GitCore.execGit` shell-interpolates its command.**
   `execSync(\`git ${args.join(" ")}\`)` — args are arrays but joined into a shell
   string. Any repo-derived arg (branch / ref / remote names can contain shell
   metacharacters) is a potential injection. Audit call sites for attacker-influenced
   args.
   - `src/shared/repository-core/GitCore.ts` (`execGit`)

5. **CSP exempts localhost entirely + `webviewTag` enabled + dev `webSecurity:false`.**
   A malicious localhost server (including the Principal MCP bridge on `:3044`) could
   serve elevated-capability content. The dev-only `webSecurity:false` is on
   `RemoteTerminalWindow`.
   - `src/main/window/modernWindowManager.ts` (CSP localhost bypass, `webviewTag`)
   - `src/main/window/RemoteTerminalWindow.ts:40-45` (dev `webSecurity:false`)

### Highest-priority chain

Item **2** + the **localhost CSP bypass** + **`webviewTag`**: an arbitrary file-write
reachable from a renderer is the chain most worth closing first. In isolation each piece
is low-risk because the renderer is trusted.

## WebSocket backend review (messaging-server)

Reviewed the two WebSocket services that back git-sync / presence, both under
`/Users/griever/Developer/messaging-server` (same repo group as the `auth-server` from
this investigation):

- `control-tower-core` — the reusable WebSocket framework (rooms, locks, presence).
- `repository-traffic-controller` — the Next.js + WebSocket service that consumes it and
  owns the real auth adapter and token-minting HTTP routes. This is where the live risk is.

Findings below were **confirmed by reading the code AND tracing what's actually wired into
the running server.** Two corrections to the first-pass agent sweep are folded in (the sweep
over-escalated both the WS fallback and the mint routes); the verified picture is recorded
here. Status as of 2026-06-01: items 1 and 2 are **fixed**; the rest are open.

### Live production entry point (so severity is grounded)

Prod runs `dist/server-control-tower.js`, compiled from **`server-control-tower.ts`**
(Dockerfile `CMD ["node","dist/server-control-tower.js"]`; pm2 deploy scripts the same).
That file: (a) wires the WebSocket server using **control-tower-core's**
`WebSocketServerTransportAdapter` + `BaseServer` + **`JWTAuthAdapter`** as the auth adapter
(`server-control-tower.ts:207-264`), and (b) delegates all non-`/ws` HTTP to the Next.js
handler (`:74-75,1061-1072`) — so `app/api/**` routes are live.

The root-level `server-control-tower.js` / `server-control-tower.mjs` (Sept 2025, ~9 KB)
are **stale legacy files referenced by nothing live** — they're the only things that
instantiate `lib/adapters/ControlTowerTransportAdapter`. Worth deleting to avoid confusion.

### FIXED

1. **(was flagged CRITICAL — corrected to dead code) WebSocket "legacy fallback" auth
   bypass.** `ControlTowerTransportAdapter.authenticateClient` had an `else if (messageData)`
   branch that set `authenticated = true` for any dot-less token, trusting client-supplied
   `repoId`/`agentId` with no verification. **But that adapter is NOT on the live path** —
   the running server authenticates via `JWTAuthAdapter.validateToken`
   (`lib/adapters/JWTAuthAdapter.ts:27-100`), which always `jwt.verify`s with HS256 + issuer
   `dev-collab-auth-server` and throws on failure. No bypass exists in production. The first
   pass mistook the dead adapter for the live one.
   - **Done anyway (defense-in-depth):** removed the fallback branch from
     `ControlTowerTransportAdapter.ts` so the exported-but-unused adapter can't be footgun-
     wired later. Recommend also deleting that adapter + the stale `server-control-tower.js`/
     `.mjs`.

2. **(was flagged HIGH-latent — this one was real and is now fixed) `/api/register` and
   `/api/auth/exchange` minted signed JWTs with no GitHub verification.** Both are live Next.js
   routes. Previously they only checked field presence (`// TODO: Verify GitHub token`;
   `userId = Math.random()`). The output isn't honored by the live WS today (it signs with
   `syncJwtSecret`/no issuer; the WS requires `roomTokenSecret` + issuer; and the only
   `syncJwtSecret` consumer `lib/auth-middleware.ts` is defined-but-never-instantiated) — but
   they are live endpoints handing signed tokens to any caller, so they were fixed regardless.
   - **Done:** both routes now call `GitHubAuthService.verifyRepoAccess(githubToken, repoId)`
     before minting, return 401 on invalid token / 403 on no access, and derive
     `sync:write`/`sync:broadcast` from real GitHub push permission. `/api/register` now uses
     the (previously dead) `secure-route.ts` logic and `secure-route.ts` was deleted to
     consolidate. Typecheck clean (`tsc --noEmit` exit 0); 91/91 unit tests pass.
   - Files: `app/api/register/route.ts`, `app/api/auth/exchange/route.ts`.

### PARTIALLY DONE

3. **Unauthenticated, wildcard-CORS webhook/status routes.** Partly addressed this session.
   - **Done:** the two debug-only broadcast endpoints `POST /api/webhooks/events` and
     `POST /api/webhooks/test` now 404 in production via a shared `blockInProduction()` guard
     (`lib/dev-only.ts`). Removed the pointless `Access-Control-Allow-Origin: *` from
     `POST /api/webhooks/github`'s OPTIONS (GitHub delivers server-to-server; browsers never
     call it).
   - **Still open — `GET /api/webhooks/events` is live and unauthenticated.** It returns
     global cross-repo event history (repos/branches/commits) and **the electron client
     fetches it in production with no auth header** (`electron-app
     src/main/services/GitSyncIPC.ts:342`, channel `git-sync:fetch-events`). So it cannot
     simply be dev-gated or auth-gated without a matching electron change. Fix needs two
     coordinated steps: (a) require a registration/room JWT on the route and scope returned
     events to the repos that token grants; (b) update `GitSyncIPC` to send the room token
     it already holds. CORS note: stripping `ACAO:*` here only matters once it's reachable
     from a victim's browser network; auth is the higher-value fix.
   - **Untouched (need external-caller trace first):** `ACAO:*` on `GET
     /api/github-app/status` (leaks per-repo install state) and `/api/github-app/install-url`
     (low concern), plus `server-control-tower.ts:969,1034`. Left as-is because a browser UI
     in another repo (landing-page / electron) may rely on them — confirm callers before
     tightening.

### MEDIUM / hygiene

4. **Shared static signing secret with an insecure in-code default.** `roomTokenSecret` /
   `syncJwtSecret` fall back to literals like `'development-secret-change-in-production'`
   when env is unset (`lib/config/config-service.ts:24-26`). One shared HMAC secret signs
   all tokens; production config only *warns*, doesn't fail closed.
   - **Correction to first-pass sweep:** the real-looking 64-hex `ROOM_TOKEN_SECRET` in
     `.env.local` is **not** committed — only `.env.example` is git-tracked and
     `git log -S` finds the value nowhere. Local working-tree value, not a git exposure.

5. **`control-tower-core` ships permissive framework defaults** the consumer must override:
   `requireAuth`/`closeOnAuthFailure` default false, no `Origin`/`verifyClient` check on the
   WS handshake, no connection/message rate limits, unbounded room history; room join has no
   per-room ACL and auto-creates rooms. Severity depends on consumer config; the live issue
   is the consumer's fallback (item 1), so this is secondary.
   - `control-tower-core/src/adapters/websocket/WebSocketServerTransportAdapter.ts`,
     `control-tower-core/src/server/BaseServer.ts`

### Electron client is clean on this path

The desktop app does **not** use the vulnerable HTTP mint routes. `GitSyncWebSocketManager`
fetches a room token from the auth/OAuth server via `getRoomToken(...)` and connects with a
`JWTAuthAdapter` carrying that token (`src/main/services/GitSyncWebSocketManager.ts:311-346`,
`src/renderer/services/git-sync/GitSyncClient.ts:301-332`). That token is a proper
`dev-collab-auth-server`-issued JWT, so it goes through the *verified* WS branch, not the
fallback.

### Remaining priority

With items 1 (dead code, hardened) and 2 (live mint routes, fixed) handled, the open work is
item 3 (auth + CORS on the webhook/status routes), then the hygiene items (4: env-driven
secrets that fail closed in prod; 5: tighten control-tower-core framework defaults; delete
the stale `server-control-tower.js/.mjs` + the dead `ControlTowerTransportAdapter`).
