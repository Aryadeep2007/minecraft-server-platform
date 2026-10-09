# Minecraft Management API and Paper Bridge

## Purpose

The Minecraft Management API is the shared backend planned for the web dashboard and Discord bot. It is implemented with FastAPI and provides endpoints for Minecraft server control, player administration, settings, and world management.

The custom PaperManagementBridge plugin provides a local HTTP bridge to Paper/Bukkit operations, including per-world gamerule management.

## Architecture

~~~text
Future Web Dashboard / Discord Bot
                |
                v
Minecraft Management API (FastAPI/Uvicorn)
                |
                v
Bridge service in the API
                |
                v
PaperManagementBridge plugin
                |
                v
Paper/Bukkit API
                |
                v
Minecraft worlds and settings
~~~

The services run inside Proxmox LXC container 100 (`minecraft`).

| Component | Location |
|---|---|
| Management API | `/opt/minecraft-management` |
| Python environment | `/opt/minecraft-management/.venv` |
| API service | `minecraft-management.service` |
| Minecraft server directory | `/opt/minecraft` |
| Bridge plugin JAR | `/opt/minecraft/plugins/PaperManagementBridge.jar` |
| API loopback address | `127.0.0.1:8000` |
| Bridge loopback address | `127.0.0.1:25586` |

## Security

- The API and bridge are intended to remain accessible only through loopback addresses inside the Minecraft container.
- The bridge reads its bearer-token credential from `/opt/minecraft-management/secrets/bridge-token`.
- The token value must never be committed to Git or copied into documentation.
- Bridge requests use an `Authorization: Bearer ...` header. The bridge compares supplied token bytes using `MessageDigest.isEqual`.
- Minecraft RCON remains disabled.
- Do not bind management services to `0.0.0.0`, add router port forwarding, or expose management ports to the public internet.
- Before connecting a browser dashboard or remote client, ensure there is an appropriate authentication and authorization layer. Keep management access private.

## Implemented API endpoints

The routes below are registered in `app/main.py`. Their presence does not mean every endpoint has been tested end to end.

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | API identity and version |
| GET | `/health` | API health |
| GET | `/bridge/health` | Bridge health |

### Server lifecycle

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/server/status` | Read Minecraft status |
| POST | `/server/start` | Start Minecraft |
| POST | `/server/stop` | Stop Minecraft |
| POST | `/server/restart` | Restart Minecraft |

### Players and access control

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/player/list` | List players |
| GET / POST / DELETE | `/player/whitelist` | Read, add, or remove whitelist entries |
| GET / POST / DELETE | `/player/operators` | List, add, or remove operators |
| POST | `/player/kick` | Kick a player |
| GET / POST / DELETE | `/player/bans` | List, add, or remove player bans |
| GET / POST / DELETE | `/player/ip-bans` | List, add, or remove IP bans |

### Server settings

| Method | Endpoint | Purpose |
|---|---|---|
| GET / PUT | `/server/settings/difficulty` | Read or update difficulty |
| GET / PUT | `/server/settings/game-mode` | Read or update server game mode |
| GET / PUT | `/server/settings/enforce-allowlist` | Read or update allowlist enforcement |
| GET / PUT | `/server/settings/use-allowlist` | Read or update allowlist usage |
| GET / PUT | `/server/settings/autosave` | Read or update autosave |
| GET / PUT | `/server/gamerules` | Read or update server-wide gamerules |

### Worlds

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/worlds` | List worlds |
| GET | `/worlds/multiverse` | Read Multiverse world information |
| GET | `/worlds/gamerules?world=<world>` | Read gamerules for a specific world |
| PUT | `/worlds/gamerules` | Update a gamerule in a specific world |

## Per-world gamerule API

The per-world endpoints are separate from `/server/gamerules`. The bridge executes Bukkit world operations on the Minecraft server thread.

### Read gamerules

Request:

~~~http
GET /worlds/gamerules?world=creative
~~~

Example response structure:

~~~json
{
  "world": "creative",
  "gamerules": [
    {
      "key": "keep_inventory",
      "type": "boolean",
      "value": true
    },
    {
      "key": "random_tick_speed",
      "type": "integer",
      "value": 3
    }
  ]
}
~~~

The actual response contains the gamerules available in the requested world. Values are returned as typed JSON Booleans or integers.

### Update a gamerule

Request:

~~~http
PUT /worlds/gamerules
Content-Type: application/json
~~~

Body:

~~~json
{
  "world": "creative",
  "key": "keep_inventory",
  "value": true
}
~~~

Successful response:

~~~json
{
  "world": "creative",
  "gamerule": {
    "key": "keep_inventory",
    "type": "boolean",
    "value": true
  }
}
~~~

Use JSON Booleans (`true` or `false`) for Boolean rules and JSON integers for integer rules. Keys use snake_case, such as `keep_inventory` and `random_tick_speed`.

The bridge enumerates `Registry.GAME_RULE` and checks `world.isEnabled(rule)` before reading a rule or accepting an update. The API maps validation errors to HTTP 400, missing-world errors to HTTP 404, and bridge/runtime failures to HTTP 503.

## Verification record

Verified on 2026-10-10 after deploying the registry-based Paper bridge fix:

- `GET /worlds/gamerules?world=creative` returned HTTP 200.
- `GET /worlds/gamerules?world=world` returned HTTP 200.
- Both worlds returned 58 gamerules at the time of testing.
- `creative` had `keep_inventory = true`.
- `world` (Survival) had `keep_inventory = false`.
- Both worlds had `random_tick_speed = 3`.
- A same-value PUT for `creative.keep_inventory = true` returned HTTP 200, and a subsequent GET confirmed the value.
- A same-value PUT for `world.random_tick_speed = 3` returned HTTP 200, and a subsequent GET confirmed the value.
- The bridge loaded successfully after a Minecraft restart and listened on `127.0.0.1:25586`.
- Minecraft RCON remained disabled.

These tests validate the gamerule read and write paths described above. They do not establish that every API endpoint listed in this document has been exhaustively tested.

## Build the Paper bridge

Run from the `paper-management-bridge` directory on a development machine with Java 21 and Maven:

~~~powershell
mvn -DskipTests package
~~~

The plugin JAR is generated under `target/`. Build output, the local Multiverse JAR, and temporary source backups are excluded from version control. Keep a verified rollback copy before replacing the deployed plugin.
