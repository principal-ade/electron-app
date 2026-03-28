# Bruno Panel Integration

The Bruno panel provides a browser-based API client interface for testing HTTP endpoints. Since browser environments cannot make HTTP requests with full header control, the host Electron app must implement actual HTTP execution.

## Problem Solved

Users need to test APIs directly within the IDE without switching to external tools like Postman or Bruno desktop app. The Bruno panel (`@principal-ade/bruno-panels`) handles:

- Parsing `.bru` collection files
- Displaying request builders (headers, params, body editors)
- Showing formatted responses

But it cannot execute HTTP requests itself - this requires Node.js in the main process.

## Architecture

### Request Flow

1. **User Action**: User edits request in Bruno panel and clicks "Send"
2. **Panel Action**: Panel dispatches `sendRequest` action with request data and active environment
3. **IPC Bridge**: Action routed via IPC to main process
4. **HTTP Execution**: `sendBrunoRequest` handler processes request using `@usebruno/requests`
5. **Response Return**: Response data returned to panel for display

### Environment Variables

Bruno supports `{{variable}}` interpolation in:
- URLs: `{{baseUrl}}/users`
- Headers: `Authorization: Bearer {{apiKey}}`
- Query params
- Request bodies
- Auth credentials

Environments are defined in `.bru` files:
```
vars {
  baseUrl: https://api.example.com
  apiKey: {{process.env.API_KEY}}
}
```

### Request Types

| Body Type | Content-Type Header |
|-----------|---------------------|
| json | application/json |
| text | text/plain |
| xml | application/xml |
| formUrlEncoded | application/x-www-form-urlencoded |
| multipartForm | multipart/form-data |

### Authentication

Supported modes:
- **none**: No auth header
- **basic**: Base64-encoded `username:password`
- **bearer**: `Authorization: Bearer <token>`

## Error Scenarios

### Network Errors
When a request fails due to network issues (DNS, connection refused, timeout), the error is caught and returned to the panel for display.

### HTTP Errors (4xx/5xx)
HTTP error responses are still valid responses - they include status, headers, and body data. The panel displays these normally with appropriate status highlighting.

### SSL/Certificate Errors
Self-signed certificates in development may require additional configuration in the HTTP client.

## Implementation Notes

### Dependencies
```bash
npm install @usebruno/requests
```

### Key Files
- `src/main/actions/bruno-actions.ts` - Request handler implementation
- `src/main/ipc-handlers.ts` - IPC registration
- `src/preload/panel-bridge.ts` - Preload bridge (if using IPC)

### Pre/Post Scripts
Bruno supports JavaScript scripts that run before/after requests. These require sandboxed VM execution for security and are optional for initial implementation.
