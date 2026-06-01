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

Findings below were **confirmed by reading the code** unless marked "(sweep, not
re-verified)".

### CRITICAL — confirmed

1. **`/api/register` mints a repo-scoped token for ANY repo with no credential check.**
   POST `{githubToken, repoId, agentId}` returns a signed 24h JWT with
   `permissions: ['sync:read','sync:write','sync:broadcast']`. The `githubToken` is never
   validated — `// TODO: Verify GitHub token and get user info` is still a TODO; the userId
   is just `user-${Math.random()...}`. An attacker can mint a working sync token for any
   `repoId` they name.
   - `repository-traffic-controller/app/api/register/route.ts:11-49`
   - A correct, GitHub-verifying implementation exists at
     `app/api/register/secure-route.ts` but is **dead code — not wired/imported anywhere**
     (`grep` for `secure-route` returns nothing).

2. **`/api/auth/exchange` has the same hole.** POST `{githubToken, repoId, agentId}` →
   signed 1h JWT with `['sync:read','sync:write']`, no GitHub verification
   (`// TODO: Verify GitHub token with your main app`).
   - `repository-traffic-controller/app/api/auth/exchange/route.ts:8-34`

3. **WebSocket auth has an unverified fallback branch.** In `authenticateClient`, if the
   presented token contains no `.` (so it isn't treated as a JWT) and a `messageData`
   object is present, the server sets `authenticated = true` and trusts the client-supplied
   `repoId`/`agentId`/`userId` with **no signature check** ("Legacy GitHub token auth
   (fallback)"). The JWT branch above it is correct (`jwt.verify` HS256 + issuer
   `dev-collab-auth-server`), but the fallback bypasses it entirely.
   - `repository-traffic-controller/lib/adapters/ControlTowerTransportAdapter.ts:233-246`

**Net effect:** these three independently let an unauthenticated actor obtain repo-scoped
sync access to *any* `repoId` — read presence/file-activity events and broadcast forged
events into that repo's room. This is the same auth-system trust boundary as the
auth-server `/token/current` disclosure, on the realtime side.

### HIGH / MEDIUM

4. **Shared static signing secret with an insecure in-code default.**
   `roomTokenSecret` / `syncJwtSecret` fall back to literals like
   `'development-secret-change-in-production'` when env is unset
   (`repository-traffic-controller/lib/config/config-service.ts:24-25`). One shared HMAC
   secret signs all tokens; anyone who learns it can mint tokens for any room. Production
   config only *warns*, doesn't fail closed.
   - **Correction to first-pass sweep:** the real-looking 64-hex `ROOM_TOKEN_SECRET` in
     `.env.local` is **not** committed — only `.env.example` is git-tracked and
     `git log -S` finds the value nowhere. It's a local working-tree value, not a git
     exposure. Lower severity than initially flagged.

5. **Wildcard CORS + unauthenticated webhook/status routes** (sweep, not re-verified).
   `Access-Control-Allow-Origin: *` on the webhook / github-app routes; `GET
   /api/webhooks/events`, `POST /api/webhooks/test`, and `GET /api/github-app/status` were
   reported as unauthenticated (event enumeration + broadcast-to-all-clients). Worth a
   direct pass before acting.
   - `repository-traffic-controller/app/api/webhooks/**`, `app/api/github-app/**`

6. **`control-tower-core` ships permissive defaults** that the consumer must override:
   `requireAuth` and `closeOnAuthFailure` default false, no `Origin`/`verifyClient` check on
   the WS handshake, no connection/message rate limits, unbounded room event history. These
   are framework defaults — severity depends on consumer config, and the consumer
   (`repository-traffic-controller`) does enable auth, so this is secondary to items 1-3.
   - `control-tower-core/src/adapters/websocket/WebSocketServerTransportAdapter.ts`
   - `control-tower-core/src/server/BaseServer.ts` (room join has no per-room ACL;
     auto-creates rooms on join)

### Highest-priority across everything

Items **1** and **2** (unauthenticated token minting for any repo) are the most serious
findings in this whole investigation — they're remotely exploitable with a single curl and
require no foothold. Fix = wire in the existing `secure-route.ts` verification (or
equivalent) on both routes, and remove the WS fallback branch (item 3).
