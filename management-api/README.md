# FastAPI management API

This is a reviewed, sanitized copy of the API source recovered from CT100 and updated in the repository on 10 November 2026. The updated source was deployed to CT100; access settings and secret files remain outside Git. Private hostnames were replaced, and deployment paths can be overridden through environment variables. The source uses external files for the Tailscale identity allowlist, Paper bridge bearer token, and Minecraft Management Protocol secret; none of those files or values are included here.

## Requirements

- Python 3.11 or newer (the recovered source uses modern type-union syntax).
- The Python dependencies pinned in `requirements.txt`.
- A running Paper server with the Minecraft Management Protocol enabled.
- The Paper Management Bridge on loopback at port `25586`.
- A private access proxy that supplies the trusted `Tailscale-User-Login` header and serves the dashboard from the configured origin.
- Private allowlist, bridge-token, and Minecraft server-properties files readable by the API service account.

The API checks the supplied Tailscale identity against the allowlist on every request. It checks the configured `Origin` for write requests. Keep the API behind the trusted access proxy; do not expose it directly to the internet or allow clients to spoof proxy identity headers.

## Configuration

Copy `.env.example` into the service manager's private environment configuration and replace every example path/origin with values for your own installation. The Python process does not load `.env` files itself. For systemd, configure an `EnvironmentFile=` for the service and restrict that file's permissions. Keep secret values in external files with least-privilege ownership and permissions.

| Variable | Purpose |
|---|---|
| `MINECRAFT_DASHBOARD_ALLOWLIST_FILE` | File containing one authorized Tailscale login per line. |
| `MINECRAFT_DASHBOARD_DIRECTORY` | Directory containing the static dashboard files. |
| `MINECRAFT_DASHBOARD_ORIGIN` | Exact dashboard origin allowed for state-changing requests. |
| `MINECRAFT_BRIDGE_TOKEN_FILE` | File containing the bridge's 64-character hexadecimal bearer token. |
| `MINECRAFT_SERVER_PROPERTIES_FILE` | Paper `server.properties` file containing the Management Protocol secret. |
| `MINECRAFT_WORLD_DIRECTORY` | Paper world-container directory used for validated imports and reversible archives. |

Unconfigured defaults retain the historical deployment paths, while the dashboard origin defaults to a reserved example domain; write requests therefore fail closed until the origin is configured.

## Install and run for development

From the repository root in Windows PowerShell:

```powershell
cd management-api
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Set the six environment variables for your development environment before starting the API. They must point to real external services/files; this repository does not provision Paper, the bridge, an access proxy, or secret files. Use absolute paths and keep secret files outside the checkout. Then run:

```powershell
.\.venv\Scripts\python.exe -m compileall -q app
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Expected startup output includes Uvicorn listening on loopback port `8000`. `GET /health` returns `{"status":"healthy"}` after the middleware accepts a valid Tailscale identity header. The world routes require a reachable Paper bridge; player/settings routes require a reachable Minecraft Management Protocol endpoint. Do not bind the API to a public interface.

## Current routes

The tracked implementation includes server status/start/stop/restart; player list, whitelist, operator, ban, and IP-ban management; server settings and gamerules; bridge health; world and Multiverse listing; per-world gamerule reads/updates; confirmed world load/unload/create; validated ZIP import; and reversible world archive/restore. Permanent world deletion is intentionally not implemented.

The API's `unittest` suite covers world-name/path validation, confirmation, setting validation, ZIP safety, and conflict mapping. It does not exercise successful world mutations on a real Paper or Multiverse server. Review route and service code before exposing additional features. See [the API and bridge contract](../docs/management-api.md) and [world-management status](../docs/world-management.md).
