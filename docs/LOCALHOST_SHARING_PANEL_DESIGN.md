# Localhost Sharing Panel - Design Document

## Overview

The Localhost Sharing Panel enables users to securely share their local development servers with teammates through ngrok tunnels. The service provides ngrok authentication tokens via a managed auth server, abstracting away the complexity of ngrok account management.

### Goals
- Make localhost sharing as simple as possible (one-click experience)
- Handle ngrok token provisioning through our auth backend
- Provide team collaboration features (see who's sharing what)
- Offer a polished UI/UX that improves upon raw ngrok CLI

### Non-Goals (Phase 1)
- Multiple simultaneous tunnels per user
- Custom domain management
- Request inspection/debugging tools
- Webhook testing features

---

## User Flows

### Primary Flow: Start Sharing

1. User opens Localhost Sharing panel
2. User enters port number (e.g., `3000`) or selects from auto-detected servers
3. User clicks "Start Sharing"
4. App requests ngrok token from auth server
5. App starts ngrok tunnel with provided token
6. Public URL is displayed with copy-to-clipboard button
7. User shares URL with teammate

### Secondary Flow: Stop Sharing

1. User clicks "Stop Sharing" button
2. App terminates ngrok tunnel
3. Token is released/invalidated on auth server
4. UI returns to initial state

### Error Flow: Token Provisioning Failure

1. User clicks "Start Sharing"
2. Auth server request fails (network error, quota exceeded, etc.)
3. Error message displayed with actionable feedback
4. User can retry or contact support

---

## UI/UX Specifications

### Panel Layout

```
┌─────────────────────────────────────────┐
│  Localhost Sharing                      │
├─────────────────────────────────────────┤
│                                         │
│  Share Your Dev Server                  │
│  ┌─────────────────────────────────┐   │
│  │ Port:  [3000          ] [Scan]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Auto-detected servers:                 │
│  ○ localhost:3000 (Vite)                │
│  ○ localhost:8080 (Node.js)             │
│                                         │
│  [ Start Sharing ]                      │
│                                         │
├─────────────────────────────────────────┤
│  Active Tunnel                          │
│  ┌─────────────────────────────────┐   │
│  │ https://abc-123.ngrok.io  [📋] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Status: ● Active (2m 34s)              │
│  Requests: 12                           │
│                                         │
│  [ Stop Sharing ]                       │
│                                         │
└─────────────────────────────────────────┘
```

### States

#### Idle State
- Port input field enabled
- "Scan" button available
- Auto-detected servers list (if any)
- "Start Sharing" button enabled
- No active tunnel section visible

#### Loading State
- "Requesting token..." spinner
- All inputs disabled
- Loading indicator

#### Active State
- Port input disabled
- Tunnel URL displayed prominently
- Copy button next to URL
- Status indicator (green dot)
- Uptime counter
- Request counter (optional for v1)
- "Stop Sharing" button enabled

#### Error State
- Error message banner with icon
- Retry button
- Port input re-enabled
- Helpful error messages:
  - "Network error - check your connection"
  - "Quota exceeded - upgrade your plan"
  - "Port not available - try a different port"

### Visual Design

**Color Scheme:**
- Primary action: Blue (#0066FF)
- Success/Active: Green (#00CC66)
- Error: Red (#FF3B30)
- Background: Match app theme (light/dark mode support)

**Typography:**
- Panel title: 18px, semibold
- Section headers: 14px, medium
- Body text: 13px, regular
- Tunnel URL: 14px, monospace font

**Spacing:**
- Panel padding: 16px
- Section gaps: 24px
- Input field height: 36px
- Button height: 36px

---

## Technical Architecture

### Components

```
LocalhostSharingPanel (React Component)
├── PortSelector
│   ├── PortInput
│   └── PortScanner
├── TunnelManager
│   ├── TunnelStatus
│   └── TunnelControls
└── ErrorBoundary
```

### Data Flow

```
User Action → Panel Component → IPC → Main Process → Auth Server → ngrok
                                  ↓                      ↓
                            State Update ← Token ← Response
```

### Auth Server Integration

#### Token Request

**Endpoint:** `POST /api/v1/tunnels/token`

**Headers:**
```json
{
  "Authorization": "Bearer {user_access_token}",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "userId": "user_12345",
  "port": 3000,
  "requestedDuration": 3600
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "ngrokToken": "2abc...xyz",
    "tunnelId": "tunnel_67890",
    "expiresAt": "2025-11-08T15:30:00Z",
    "maxConnections": 40
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You've reached your tunnel limit for today",
    "retryAfter": 3600
  }
}
```

#### Token Release

**Endpoint:** `DELETE /api/v1/tunnels/{tunnelId}`

**Headers:**
```json
{
  "Authorization": "Bearer {user_access_token}"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tunnel token released"
}
```

### ngrok Integration

#### Main Process (Electron)

```typescript
import ngrok from '@ngrok/ngrok';

interface TunnelConfig {
  port: number;
  authtoken: string;
}

class NgrokManager {
  private listener: any = null;
  private tunnelId: string | null = null;

  async startTunnel(config: TunnelConfig): Promise<string> {
    try {
      this.listener = await ngrok.forward({
        addr: config.port,
        authtoken: config.authtoken,
      });

      const url = this.listener.url();
      return url;
    } catch (error) {
      throw new Error(`Failed to start tunnel: ${error.message}`);
    }
  }

  async stopTunnel(): Promise<void> {
    if (this.listener) {
      await this.listener.close();
      this.listener = null;
    }
  }

  isActive(): boolean {
    return this.listener !== null;
  }
}
```

#### IPC Handlers

```typescript
// Main process
ipcMain.handle('tunnel:start', async (event, port: number) => {
  // 1. Request token from auth server
  const tokenResponse = await authClient.requestTunnelToken(port);

  // 2. Start ngrok tunnel
  const url = await ngrokManager.startTunnel({
    port,
    authtoken: tokenResponse.ngrokToken,
  });

  // 3. Store tunnel metadata
  activeTunnels.set(tokenResponse.tunnelId, {
    url,
    port,
    startTime: Date.now(),
  });

  return {
    success: true,
    url,
    tunnelId: tokenResponse.tunnelId,
  };
});

ipcMain.handle('tunnel:stop', async (event, tunnelId: string) => {
  // 1. Stop ngrok tunnel
  await ngrokManager.stopTunnel();

  // 2. Release token on auth server
  await authClient.releaseTunnelToken(tunnelId);

  // 3. Clean up local state
  activeTunnels.delete(tunnelId);

  return { success: true };
});

ipcMain.handle('tunnel:status', async () => {
  const tunnel = Array.from(activeTunnels.values())[0];
  if (!tunnel) {
    return { active: false };
  }

  return {
    active: true,
    url: tunnel.url,
    uptime: Date.now() - tunnel.startTime,
  };
});
```

#### Renderer Process (React)

```typescript
// hooks/useTunnel.ts
export function useTunnel() {
  const [status, setStatus] = useState<TunnelStatus>('idle');
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startTunnel = async (port: number) => {
    setStatus('loading');
    setError(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('tunnel:start', port);

      if (result.success) {
        setTunnelUrl(result.url);
        setStatus('active');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const stopTunnel = async () => {
    try {
      await window.electron.ipcRenderer.invoke('tunnel:stop');
      setTunnelUrl(null);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
    }
  };

  return { status, tunnelUrl, error, startTunnel, stopTunnel };
}
```

### Port Detection

```typescript
// utils/portScanner.ts
import net from 'net';

export async function scanCommonPorts(): Promise<OpenPort[]> {
  const COMMON_PORTS = [3000, 3001, 4200, 5000, 8000, 8080, 8888, 9000];
  const openPorts: OpenPort[] = [];

  for (const port of COMMON_PORTS) {
    const isOpen = await checkPort(port);
    if (isOpen) {
      const type = detectServerType(port);
      openPorts.push({ port, type });
    }
  }

  return openPorts;
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

function detectServerType(port: number): string {
  const typeMap: Record<number, string> = {
    3000: 'Vite/React',
    3001: 'Next.js',
    4200: 'Angular',
    5000: 'Flask/Python',
    8000: 'Django',
    8080: 'Node.js',
  };

  return typeMap[port] || 'Unknown';
}
```

---

## Security Considerations

### Token Management
- **Tokens never stored locally** - fetched on-demand and held in memory only
- **Short-lived tokens** - 1-hour expiration by default
- **Automatic cleanup** - tokens released when app closes or tunnel stops
- **One token per user** - enforce single active tunnel limit

### Network Security
- **HTTPS only** - ngrok provides TLS by default
- **No custom domains** (Phase 1) - reduces attack surface
- **Rate limiting** - auth server enforces request limits
- **Audit logging** - log all tunnel creation/deletion events

### User Privacy
- **No request interception** - Phase 1 doesn't log traffic
- **Explicit consent** - users must click "Start Sharing" (no auto-start)
- **Clear status indicator** - always visible when tunnel is active

---

## State Management

```typescript
interface TunnelState {
  status: 'idle' | 'loading' | 'active' | 'error';
  tunnelId: string | null;
  tunnelUrl: string | null;
  port: number | null;
  startTime: number | null;
  error: string | null;
  requestCount: number;
}

const initialState: TunnelState = {
  status: 'idle',
  tunnelId: null,
  tunnelUrl: null,
  port: null,
  startTime: null,
  error: null,
  requestCount: 0,
};
```

---

## Error Handling

### Client-Side Errors

| Error | Cause | User Message | Action |
|-------|-------|--------------|--------|
| PORT_IN_USE | Port not available | "Port {port} is not available" | Try different port |
| NETWORK_ERROR | Can't reach auth server | "Connection error. Check your internet." | Retry button |
| QUOTA_EXCEEDED | Hit tunnel limits | "Daily tunnel limit reached" | Upgrade prompt |
| INVALID_TOKEN | Token expired/invalid | "Session expired. Please try again." | Auto-retry |
| NGROK_ERROR | ngrok client error | "Tunnel failed to start" | Show logs link |

### Logging

```typescript
// Log all tunnel events for debugging
logger.info('Tunnel started', { port, tunnelId, url });
logger.error('Tunnel failed', { port, error: err.message, stack: err.stack });
logger.info('Tunnel stopped', { tunnelId, duration });
```

---

## Future Enhancements (Phase 2+)

### Team Features
- **Team dashboard** - see all active tunnels from team members
- **Tunnel sharing** - "@mention" teammates to share tunnel
- **Access logs** - see who accessed your tunnel

### Advanced Features
- **Request inspection** - built-in HTTP debugger
- **Multiple tunnels** - run several ports simultaneously
- **Custom subdomains** - `myapp.yourdomain.dev`
- **Tunnel history** - quick re-share recent tunnels
- **QR codes** - easy mobile device testing
- **Webhook forwarding** - integrate with services

### Integrations
- **Slack** - post tunnel URLs to channels
- **GitHub** - comment tunnel links on PRs
- **VS Code** - share from editor command palette

---

## Open Questions

1. **Pricing model** - How do we charge for this service?
   - Per-user subscription?
   - Per-tunnel-hour usage?
   - Team pricing tiers?

2. **ngrok plan** - Which ngrok tier do we need?
   - Free tier: 1 agent, 40 req/min (won't scale)
   - Personal: $10/mo, better limits (testing)
   - Pro: $25/mo/user, reseller needed for production

3. **Token lifecycle** - When to refresh/rotate tokens?
   - Refresh before expiry?
   - New token per session?
   - Reuse tokens across sessions?

4. **Offline mode** - What happens without internet?
   - LocalTunnel fallback?
   - Error message only?
   - Queue for later?

5. **Analytics** - What metrics to track?
   - Tunnel creation count
   - Average duration
   - Error rates
   - Popular ports

---

## Success Metrics

### Phase 1 KPIs
- **Adoption rate** - % of users who try the feature
- **Weekly active tunnels** - number of tunnels created per week
- **Average tunnel duration** - how long users keep tunnels open
- **Error rate** - % of failed tunnel attempts
- **Time to share** - seconds from click to shareable URL

### User Satisfaction
- **NPS score** - would you recommend this feature?
- **Support tickets** - tunnel-related issues
- **Feature requests** - what do users want next?

---

## Implementation Phases

### Phase 1: MVP (Week 1-2)
- [ ] Basic UI panel with port input
- [ ] Auth server token endpoint
- [ ] ngrok integration (start/stop)
- [ ] Copy URL functionality
- [ ] Error handling and logging

### Phase 2: Polish (Week 3-4)
- [ ] Port auto-detection
- [ ] Status indicators and uptime
- [ ] Better error messages
- [ ] Loading states and animations
- [ ] Settings panel

### Phase 3: Team Features (Month 2)
- [ ] Team dashboard
- [ ] Tunnel sharing
- [ ] Activity logs
- [ ] Usage analytics

---

## Dependencies

### npm Packages
```json
{
  "@ngrok/ngrok": "^1.0.0"
}
```

### Backend Services
- Auth server with tunnel token endpoints
- User authentication/authorization
- Usage tracking and analytics
- Rate limiting service

### Infrastructure
- ngrok account (Pro tier recommended)
- Database for tunnel metadata
- Redis for token caching (optional)

---

## API Reference

See [Auth Server Integration](#auth-server-integration) section above for detailed API specs.

---

## Appendix

### Competitive Analysis

| Feature | Our Tool | ngrok CLI | LocalTunnel | Cloudflare Tunnel |
|---------|----------|-----------|-------------|-------------------|
| Setup time | 1-click | 2 min | 1 min | 5 min |
| UI/UX | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ |
| Reliability | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★★ |
| Team features | ★★★★☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★★☆☆ |
| Free tier | TBD | Limited | Yes | Generous |
| Pricing | TBD | $10-25/mo | Free | Free-$20/mo |

### References
- [ngrok Documentation](https://ngrok.com/docs)
- [ngrok Node.js SDK](https://github.com/ngrok/ngrok-javascript)
- [LocalTunnel Repo](https://github.com/localtunnel/localtunnel)
