# MCP OAuth Emulation

Mock LLM emulates an OAuth 2.1 authorization server so you can test OAuth-protected MCP servers end-to-end without hitting a real IdP (Notion, Atlassian, Linear, etc.).

Target fidelity: enough to drive a controller state machine (`Required → Authorized → Expired → RefreshFailed → Required`) and a CLI OAuth flow. **Not** a general-purpose authorization server.

## What's emulated

Built on `@modelcontextprotocol/sdk`'s `mcpAuthRouter`, which ships the full wire protocol:

| Endpoint | RFC | Served by mock-llm |
|---|---|---|
| `GET /.well-known/oauth-protected-resource/<path>` | RFC 9728 | yes |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 | yes |
| `POST /register` | RFC 7591 (DCR) | yes |
| `GET /authorize` (Authorization Code + PKCE S256, auto-approve) | RFC 6749 + 7636 | yes |
| `POST /token` (`authorization_code`, `refresh_token`) | RFC 6749 | yes |
| `Authorization: Bearer` gate on protected paths with RFC 9728 challenge | RFC 9728 | yes |

### Explicitly out of scope

- Real JWT signing (opaque tokens only).
- User consent UI (`/authorize` auto-approves).
- TLS (HTTP only; loopback + in-cluster).
- RFC 7009 token revocation endpoint (use the control endpoint `/oauth/revoke` instead).
- RFC 8628 Device Authorization Grant.
- Multi-tenant / multi-user isolation.

## Configuration

OAuth is disabled by default. Add an `oauth` block to your `mock-llm.yaml` (or `POST`/`PATCH /config`) to enable it:

```yaml
oauth:
  # Regex-matched request paths that require a valid Bearer.
  protectedPaths:
    - /mcp

  # Pre-registered clients (DCR-registered clients are stored in-memory and
  # survive until /oauth/reset).
  clients:
    - clientId: fixture-client
      clientSecret: fixture-secret   # omit for public (PKCE) clients
      redirectUris: ["http://127.0.0.1:39999/callback"]
      scope: "mcp:read mcp:tools"

  tokens:
    expiresInSeconds: 3600             # default: 3600
    refreshable: true                  # default: true
    rotateRefreshToken: false          # default: false
    revoked: []                        # access_tokens force-rejected
    expired: []                        # access_tokens force-expired

    # Optional deterministic token issuance. Each queue is consumed in order;
    # once empty, values fall back to crypto-random hex. Let tests assert
    # exact token strings.
    deterministic:
      nextAccessTokens: ["fixture-access-001"]
      nextRefreshTokens: ["fixture-refresh-001"]
      nextAuthorizationCodes: ["fixture-code-001"]
      nextClientIds: ["fixture-client-001"]
      nextClientSecrets: ["fixture-secret-001"]

  metadata:
    resourceName: "Mock MCP Resource"        # default
    scopesSupported: ["mcp:read", "mcp:tools"]
    registrationEndpointEnabled: true        # default — set false to hide /register
    issuerOverride: "http://localhost:6556/" # default computed from host + port
    resourcePath: "/mcp"                     # default
```

Only `issuerOverride` and `resourcePath` are read at server boot; everything else is evaluated per request so you can flip state mid-test via `PATCH /config`.

## Test control endpoints

These exist only in the fixture — real IdPs do not expose them:

| Endpoint | Body | Behaviour |
|---|---|---|
| `POST /oauth/reset` | — | Wipes issued tokens, dynamic clients, and deterministic counters. Seeded `clients` survive. |
| `POST /oauth/revoke` | `{"token": "..."}` or `{"refresh_token": "..."}` | Invalidates the token pair. Next request gated by the Bearer middleware gets a `401 invalid_token`. |
| `POST /oauth/expire` | `{"token": "..."}` | Forces the token's `expiresAt` into the past. Controllers should transition to `Expired` on the next reconcile. |
| `POST /oauth/issue` | `{"clientId": "...", "scope"?: "..."}` | Mints a Bearer without running the full flow. Use for stage-1 `MCPServer` fixtures where you pre-populate a Secret. |

## End-to-end flow

See the three executable samples for the canonical shape:

- [`samples/14-mcp-oauth-discovery.sh`](../samples/14-mcp-oauth-discovery.sh) — 401 challenge + both discovery documents.
- [`samples/15-mcp-oauth-pkce-flow.sh`](../samples/15-mcp-oauth-pkce-flow.sh) — DCR → PKCE → token exchange → authenticated `initialize`.
- [`samples/16-mcp-oauth-refresh.sh`](../samples/16-mcp-oauth-refresh.sh) — `/oauth/issue` → refresh grant → `/oauth/revoke` → `/oauth/expire`.

## Notes and gotchas

- **Issuer URL is fixed at server boot.** Changing `metadata.issuerOverride` via `PATCH /config` has no effect — restart the process or start with the desired config.
- **Protected resource metadata is served at the path-suffixed URL** (RFC 9728 §3.2), e.g. `/.well-known/oauth-protected-resource/mcp`, not at the root.
- **Issuer href includes a trailing slash.** `URL.href` always normalises to one (`http://localhost:6556/`). Assertions comparing exact strings should strip or account for it.
- **Redirect URIs must match exactly** — there is no glob support in the SDK's authorize handler. Register the exact loopback URI you plan to use.
- **PKCE S256 is required.** `plain` is rejected at discovery time (we only advertise `S256`).
- **Rate limits are disabled** in the fixture so CI can't flake on burst.
