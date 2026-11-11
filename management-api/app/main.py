import asyncio
import hmac
import os
import re
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path
from pathlib import PurePosixPath

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.services.server import control_server, get_minecraft_status
from app.services.player import get_players, kick_player
from app.services.ban import get_bans, add_ban, remove_ban
from app.services.ip_ban import get_ip_bans, add_ip_ban, remove_ip_ban
from app.services.bridge import (
    BridgeConflictError,
    archive_world,
    create_world,
    get_bridge_health,
    get_multiverse_worlds,
    get_world_gamerules,
    get_worlds,
    import_world_folder,
    load_world,
    restore_world,
    set_world_gamerule,
    unload_world,
)
from app.services.allowlist import get_allowlist, add_to_allowlist, remove_from_allowlist
from app.services.operator import get_operators, add_operator, remove_operator
from app.services.settings import get_difficulty, get_game_mode, set_difficulty, set_game_mode, get_enforce_allowlist, set_enforce_allowlist, get_use_allowlist, set_use_allowlist, get_autosave, set_autosave
from app.services.gamerule import get_gamerules, update_gamerule

app = FastAPI(
    title="Minecraft Management API",
    version="0.1.0",
)

DASHBOARD_ALLOWLIST = Path(
    os.environ.get(
        "MINECRAFT_DASHBOARD_ALLOWLIST_FILE",
        "/opt/minecraft-management/secrets/dashboard-allowed-user",
    )
)
DASHBOARD_DIRECTORY = Path(
    os.environ.get(
        "MINECRAFT_DASHBOARD_DIRECTORY",
        "/opt/minecraft-management/web-dashboard",
    )
)
DASHBOARD_ORIGIN = os.environ.get(
    "MINECRAFT_DASHBOARD_ORIGIN",
    "https://dashboard.example.invalid",
).rstrip("/")
WORLD_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,31}")
WORLD_DIRECTORY = Path(
    os.environ.get("MINECRAFT_WORLD_DIRECTORY", "/opt/minecraft")
)
MAX_WORLD_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_WORLD_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024
MAX_WORLD_ARCHIVE_ENTRIES = 100_000


def validate_world_name(value: object) -> bool:
    return (
        isinstance(value, str)
        and value == value.strip()
        and value not in {".", ".."}
        and WORLD_NAME_PATTERN.fullmatch(value) is not None
    )


def validate_world_confirmation(payload: dict) -> str:
    if set(payload) != {"name", "confirmed_name"}:
        raise HTTPException(
            status_code=400,
            detail="name and confirmed_name are required",
        )
    name = payload.get("name")
    if not validate_world_name(name):
        raise HTTPException(status_code=400, detail="invalid world name")
    if payload.get("confirmed_name") != name:
        raise HTTPException(
            status_code=400,
            detail="confirmed_name must exactly match name",
        )
    return name


def _world_root() -> Path:
    try:
        root = WORLD_DIRECTORY.resolve(strict=True)
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="world directory is unavailable",
        ) from None
    if not root.is_dir():
        raise HTTPException(
            status_code=503,
            detail="world directory is unavailable",
        )
    return root


def _extract_world_archive(archive_path: Path, world_name: str) -> Path:
    root = _world_root()
    destination = root / world_name
    if os.path.lexists(destination):
        raise HTTPException(status_code=409, detail="world folder already exists")

    try:
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > MAX_WORLD_ARCHIVE_ENTRIES:
                raise HTTPException(status_code=400, detail="archive entry count is invalid")

            seen = set()
            expanded_size = 0
            for entry in entries:
                raw_name = entry.filename.replace("\\", "/")
                if (
                    not raw_name
                    or raw_name.startswith("/")
                    or "\x00" in raw_name
                    or any(part in {"", ".", ".."} for part in raw_name.rstrip("/").split("/"))
                    or ":" in raw_name.split("/", 1)[0]
                ):
                    raise HTTPException(status_code=400, detail="archive contains an unsafe path")

                relative = PurePosixPath(raw_name)
                normalized = "/".join(relative.parts).casefold()
                if normalized in seen:
                    raise HTTPException(status_code=400, detail="archive contains duplicate paths")
                seen.add(normalized)

                mode = entry.external_attr >> 16
                file_type = stat.S_IFMT(mode)
                if file_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
                    raise HTTPException(status_code=400, detail="archive contains a link or special file")
                if entry.flag_bits & 0x1:
                    raise HTTPException(status_code=400, detail="encrypted archives are not supported")
                if entry.file_size > 0 and entry.file_size / max(entry.compress_size, 1) > 1000:
                    raise HTTPException(status_code=400, detail="archive compression ratio is too high")
                expanded_size += entry.file_size
                if expanded_size > MAX_WORLD_EXPANDED_BYTES:
                    raise HTTPException(status_code=413, detail="expanded archive exceeds the 8 GiB limit")

            if shutil.disk_usage(root).free < expanded_size + 256 * 1024 * 1024:
                raise HTTPException(status_code=507, detail="insufficient free space for safe import")

            with tempfile.TemporaryDirectory(
                prefix=f".world-import-{world_name}-", dir=root
            ) as temporary:
                extraction_root = Path(temporary) / "content"
                extraction_root.mkdir()
                written_size = 0
                for entry in entries:
                    relative = PurePosixPath(entry.filename.replace("\\", "/"))
                    target = extraction_root.joinpath(*relative.parts)
                    resolved_target = target.resolve()
                    if not resolved_target.is_relative_to(extraction_root.resolve()):
                        raise HTTPException(status_code=400, detail="archive path escaped its staging directory")
                    if entry.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(entry) as source, target.open("xb") as output:
                        while block := source.read(1024 * 1024):
                            written_size += len(block)
                            if written_size > MAX_WORLD_EXPANDED_BYTES:
                                raise HTTPException(status_code=413, detail="expanded archive exceeds the 8 GiB limit")
                            output.write(block)

                top_level = list(extraction_root.iterdir())
                if (extraction_root / "level.dat").is_file():
                    world_folder = extraction_root
                elif (
                    len(top_level) == 1
                    and top_level[0].is_dir()
                    and (top_level[0] / "level.dat").is_file()
                ):
                    world_folder = top_level[0]
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="archive must contain one Minecraft world with a level.dat file",
                    )

                if os.path.lexists(destination):
                    raise HTTPException(status_code=409, detail="world folder already exists")
                os.replace(world_folder, destination)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="uploaded file is not a valid ZIP archive") from None
    except OSError:
        raise HTTPException(status_code=507, detail="world archive could not be safely extracted") from None

    return destination


async def _save_uploaded_archive(request: Request, destination: Path) -> int:
    declared_length = request.headers.get("content-length")
    if declared_length:
        try:
            if int(declared_length) > MAX_WORLD_ARCHIVE_BYTES:
                raise HTTPException(status_code=413, detail="archive exceeds the 256 MiB upload limit")
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid content length") from None

    total = 0
    try:
        with destination.open("xb") as output:
            async for chunk in request.stream():
                total += len(chunk)
                if total > MAX_WORLD_ARCHIVE_BYTES:
                    raise HTTPException(status_code=413, detail="archive exceeds the 256 MiB upload limit")
                await asyncio.to_thread(output.write, chunk)
            await asyncio.to_thread(output.flush)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    except OSError:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=507, detail="could not save the uploaded archive") from None
    return total


@app.middleware("http")
async def require_tailscale_allowlist(request: Request, call_next):
    try:
        allowlist_text = DASHBOARD_ALLOWLIST.read_text(encoding="utf-8")
    except OSError:
        return JSONResponse(
            status_code=503,
            content={"detail": "Dashboard access control unavailable"},
        )

    allowed_logins = {
        line.strip().casefold()
        for line in allowlist_text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    }
    supplied_login = request.headers.get(
        "Tailscale-User-Login", ""
    ).strip().casefold()

    if not supplied_login or not any(
        hmac.compare_digest(supplied_login, allowed)
        for allowed in allowed_logins
    ):
        return JSONResponse(
            status_code=403,
            content={"detail": "Tailscale identity not allowed"},
        )

    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        supplied_origin = request.headers.get("Origin", "").strip().rstrip("/")
        if not hmac.compare_digest(supplied_origin, DASHBOARD_ORIGIN):
            return JSONResponse(
                status_code=403,
                content={"detail": "Cross-origin write request denied"},
            )

    return await call_next(request)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Minecraft Management API",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/server/status")
async def server_status():
    return await get_minecraft_status()


@app.post("/server/start")
def server_start():
    try:
        return {
            "minecraft": control_server("start")
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/server/stop")
def server_stop():
    try:
        return {
            "minecraft": control_server("stop")
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/server/restart")
def server_restart():
    try:
        return {
            "minecraft": control_server("restart")
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/player/list")
async def player_list():
    return {
        "players": await get_players()
    }


@app.get("/player/whitelist")
async def player_whitelist():
    return {
        "players": await get_allowlist()
    }


@app.get("/player/operators")
async def player_operators():
    return {
        "players": await get_operators()
    }


@app.get("/server/settings/difficulty")
async def server_difficulty():
    return {
        "difficulty": await get_difficulty()
    }


@app.get("/server/settings/game-mode")
async def server_game_mode():
    return {
        "game_mode": await get_game_mode()
    }


@app.get("/server/gamerules")
async def server_gamerules():
    return {
        "gamerules": await get_gamerules()
    }


@app.put("/server/gamerules")
async def set_gamerule(payload: dict):
    key = payload.get("key")
    value = payload.get("value")

    if not isinstance(key, str) or not key:
        raise HTTPException(status_code=400, detail="key must be a non-empty string")

    if not isinstance(value, (bool, int)):
        raise HTTPException(status_code=400, detail="value must be boolean or integer")

    return {
        "gamerule": await update_gamerule(key, value)
    }


@app.put("/server/settings/difficulty")
async def set_server_difficulty(payload: dict):
    difficulty = payload.get("difficulty")

    if difficulty not in {"peaceful", "easy", "normal", "hard"}:
        raise HTTPException(
            status_code=400,
            detail="difficulty must be peaceful, easy, normal, or hard",
        )

    return {
        "difficulty": await set_difficulty(difficulty)
    }


@app.put("/server/settings/game-mode")
async def set_server_game_mode(payload: dict):
    mode = payload.get("mode")

    if mode not in {"survival", "creative", "adventure", "spectator"}:
        raise HTTPException(
            status_code=400,
            detail="mode must be survival, creative, adventure, or spectator",
        )

    return {
        "game_mode": await set_game_mode(mode)
    }


@app.post("/player/whitelist")
async def whitelist_add(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    name = player.get("name")

    if not isinstance(name, str) or not name.strip():
        raise HTTPException(
            status_code=400,
            detail="player.name must be a non-empty string",
        )

    return {
        "players": await add_to_allowlist(player)
    }


@app.delete("/player/whitelist")
async def whitelist_remove(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    name = player.get("name")

    if not isinstance(name, str) or not name.strip():
        raise HTTPException(
            status_code=400,
            detail="player.name must be a non-empty string",
        )

    return {
        "players": await remove_from_allowlist(player)
    }


@app.post("/player/operators")
async def operator_add(payload: dict):
    operator = payload.get("operator")

    if not isinstance(operator, dict):
        raise HTTPException(
            status_code=400,
            detail="operator must be an object",
        )

    player = operator.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="operator.player must be an object",
        )

    name = player.get("name")

    if not isinstance(name, str) or not name.strip():
        raise HTTPException(
            status_code=400,
            detail="operator.player.name must be a non-empty string",
        )

    return {
        "players": await add_operator(operator)
    }


@app.delete("/player/operators")
async def operator_remove(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    name = player.get("name")

    if not isinstance(name, str) or not name.strip():
        raise HTTPException(
            status_code=400,
            detail="player.name must be a non-empty string",
        )

    return {
        "players": await remove_operator(player)
    }


@app.get("/server/settings/enforce-allowlist")
async def server_enforce_allowlist():
    return {
        "enforced": await get_enforce_allowlist()
    }


@app.put("/server/settings/enforce-allowlist")
async def set_server_enforce_allowlist(payload: dict):
    enforced = payload.get("enforced")

    if not isinstance(enforced, bool):
        raise HTTPException(
            status_code=400,
            detail="enforced must be boolean",
        )

    return {
        "enforced": await set_enforce_allowlist(enforced)
    }


@app.get("/server/settings/use-allowlist")
async def server_use_allowlist():
    return {
        "enabled": await get_use_allowlist()
    }


@app.put("/server/settings/use-allowlist")
async def set_server_use_allowlist(payload: dict):
    enabled = payload.get("enabled")

    if not isinstance(enabled, bool):
        raise HTTPException(
            status_code=400,
            detail="enabled must be boolean",
        )

    return {
        "enabled": await set_use_allowlist(enabled)
    }


@app.get("/server/settings/autosave")
async def server_autosave():
    return {
        "enabled": await get_autosave()
    }


@app.put("/server/settings/autosave")
async def set_server_autosave(payload: dict):
    enabled = payload.get("enabled")

    if not isinstance(enabled, bool):
        raise HTTPException(
            status_code=400,
            detail="enabled must be boolean",
        )

    return {
        "enabled": await set_autosave(enabled)
    }


@app.post("/player/kick")
async def player_kick(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    for field in ("name", "id"):
        value = player.get(field)
        if not isinstance(value, str) or not value.strip():
            raise HTTPException(
                status_code=400,
                detail=f"player.{field} must be a non-empty string",
            )

    message = payload.get("message", "Kicked by server administrator")

    if not isinstance(message, str):
        raise HTTPException(
            status_code=400,
            detail="message must be a string",
        )

    return {
        "players": await kick_player(player, message)
    }


@app.get("/player/bans")
async def player_bans():
    return {
        "players": await get_bans()
    }


@app.post("/player/bans")
async def player_ban(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    for field in ("name", "id"):
        value = player.get(field)
        if not isinstance(value, str) or not value.strip():
            raise HTTPException(
                status_code=400,
                detail=f"player.{field} must be a non-empty string",
            )

    reason = payload.get("reason", "Banned by server administrator")
    source = payload.get("source", "Management API")
    expires = payload.get("expires")

    if not isinstance(reason, str) or not reason.strip():
        raise HTTPException(
            status_code=400,
            detail="reason must be a non-empty string",
        )

    if not isinstance(source, str) or not source.strip():
        raise HTTPException(
            status_code=400,
            detail="source must be a non-empty string",
        )

    if expires is not None and not isinstance(expires, str):
        raise HTTPException(
            status_code=400,
            detail="expires must be a string or null",
        )

    return {
        "players": await add_ban(player, reason, source, expires)
    }


@app.delete("/player/bans")
async def player_unban(payload: dict):
    player = payload.get("player")

    if not isinstance(player, dict):
        raise HTTPException(
            status_code=400,
            detail="player must be an object",
        )

    for field in ("name", "id"):
        value = player.get(field)
        if not isinstance(value, str) or not value.strip():
            raise HTTPException(
                status_code=400,
                detail=f"player.{field} must be a non-empty string",
            )

    return {
        "players": await remove_ban(player)
    }


@app.get("/player/ip-bans")
async def player_ip_bans():
    return {
        "bans": await get_ip_bans()
    }


@app.post("/player/ip-bans")
async def create_ip_ban(payload: dict):
    import ipaddress

    ip = payload.get("ip")

    if not isinstance(ip, str) or not ip.strip():
        raise HTTPException(
            status_code=400,
            detail="ip must be a non-empty string",
        )

    try:
        ipaddress.ip_address(ip.strip())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="ip must be a valid IPv4 or IPv6 address",
        )

    reason = payload.get("reason", "IP banned by server administrator")
    source = payload.get("source", "Management API")
    expires = payload.get("expires")

    if not isinstance(reason, str) or not reason.strip():
        raise HTTPException(
            status_code=400,
            detail="reason must be a non-empty string",
        )

    if not isinstance(source, str) or not source.strip():
        raise HTTPException(
            status_code=400,
            detail="source must be a non-empty string",
        )

    if expires is not None and not isinstance(expires, str):
        raise HTTPException(
            status_code=400,
            detail="expires must be a string or null",
        )

    return {
        "bans": await add_ip_ban(ip.strip(), reason, source, expires)
    }


@app.delete("/player/ip-bans")
async def delete_ip_ban(payload: dict):
    import ipaddress

    ip = payload.get("ip")

    if not isinstance(ip, str) or not ip.strip():
        raise HTTPException(
            status_code=400,
            detail="ip must be a non-empty string",
        )

    try:
        ipaddress.ip_address(ip.strip())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="ip must be a valid IPv4 or IPv6 address",
        )

    return {
        "bans": await remove_ip_ban(ip.strip())
    }


@app.get("/bridge/health")
async def bridge_health():
    try:
        return await get_bridge_health()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.get("/worlds")
async def worlds():
    try:
        return await get_worlds()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.get("/worlds/multiverse")
async def multiverse_worlds():
    try:
        return await get_multiverse_worlds()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/load")
async def load_world_route(payload: dict):
    name = validate_world_confirmation(payload)
    try:
        return await load_world(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/unload")
async def unload_world_route(payload: dict):
    name = validate_world_confirmation(payload)
    try:
        return await unload_world(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/create")
async def create_world_route(payload: dict):
    required = {
        "name",
        "confirmed_name",
        "environment",
        "world_type",
        "game_mode",
        "difficulty",
        "generate_structures",
    }
    if set(payload) != required:
        raise HTTPException(
            status_code=400,
            detail="world creation fields are missing or unexpected",
        )

    name = payload.get("name")
    if not validate_world_name(name):
        raise HTTPException(status_code=400, detail="invalid world name")
    if payload.get("confirmed_name") != name:
        raise HTTPException(
            status_code=400,
            detail="confirmed_name must exactly match name",
        )

    allowed_values = {
        "environment": {"NORMAL", "NETHER", "THE_END"},
        "world_type": {"NORMAL", "FLAT", "LARGE_BIOMES", "AMPLIFIED"},
        "game_mode": {"SURVIVAL", "CREATIVE", "ADVENTURE", "SPECTATOR"},
        "difficulty": {"PEACEFUL", "EASY", "NORMAL", "HARD"},
    }
    for field, choices in allowed_values.items():
        if payload.get(field) not in choices:
            raise HTTPException(
                status_code=400,
                detail=f"unsupported {field.replace('_', ' ')}",
            )
    if not isinstance(payload.get("generate_structures"), bool):
        raise HTTPException(
            status_code=400,
            detail="generate_structures must be boolean",
        )

    try:
        return await create_world(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/archive")
async def archive_world_route(payload: dict):
    name = validate_world_confirmation(payload)
    try:
        return await archive_world(name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/restore")
async def restore_world_route(payload: dict):
    name = validate_world_confirmation(payload)
    try:
        return await restore_world(name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/worlds/import")
async def import_world_route(request: Request):
    name = request.headers.get("X-World-Name", "")
    confirmed_name = request.headers.get("X-World-Confirmation", "")
    environment = request.headers.get("X-World-Environment", "")
    if not validate_world_name(name) or confirmed_name != name:
        raise HTTPException(
            status_code=400,
            detail="valid world name and exact X-World-Confirmation are required",
        )
    if environment not in {"NORMAL", "NETHER", "THE_END"}:
        raise HTTPException(status_code=400, detail="unsupported world environment")
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/zip":
        raise HTTPException(status_code=415, detail="upload must use application/zip")

    root = _world_root()
    destination = root / name
    if os.path.lexists(destination):
        raise HTTPException(status_code=409, detail="world folder already exists")

    descriptor, archive_name = tempfile.mkstemp(
        prefix=".world-upload-", suffix=".zip", dir=root
    )
    os.close(descriptor)
    archive_path = Path(archive_name)
    archive_path.unlink()
    try:
        await _save_uploaded_archive(request, archive_path)
        await asyncio.to_thread(_extract_world_archive, archive_path, name)
    finally:
        archive_path.unlink(missing_ok=True)

    try:
        return await import_world_folder(name, environment)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="world files were preserved, but Multiverse rejected registration; review the server and use the register route to retry",
        ) from None
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="world files were preserved, but Multiverse could not register the world",
        ) from None
    except BridgeConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail="world files were preserved, but Multiverse rejected registration; use the register route to retry",
        ) from None
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="world files were preserved, but registration is unavailable; use the register route to retry",
        ) from None


@app.post("/worlds/register")
async def register_world_route(payload: dict):
    if set(payload) != {"name", "confirmed_name", "environment"}:
        raise HTTPException(
            status_code=400,
            detail="name, confirmed_name, and environment are required",
        )
    name = payload.get("name")
    if not validate_world_name(name) or payload.get("confirmed_name") != name:
        raise HTTPException(status_code=400, detail="invalid world confirmation")
    environment = payload.get("environment")
    if environment not in {"NORMAL", "NETHER", "THE_END"}:
        raise HTTPException(status_code=400, detail="unsupported world environment")
    root = _world_root()
    folder = root / name
    level_file = folder / "level.dat"
    if (
        folder.parent != root
        or not folder.is_dir()
        or folder.is_symlink()
        or level_file.is_symlink()
        or not level_file.is_file()
    ):
        raise HTTPException(status_code=400, detail="existing world folder is invalid")
    try:
        return await import_world_folder(name, environment)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except BridgeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None



@app.get("/worlds/gamerules")
async def world_gamerules(world: str):
    if not world.strip():
        raise HTTPException(status_code=400, detail="world must not be empty")
    try:
        return await get_world_gamerules(world)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.put("/worlds/gamerules")
async def update_world_gamerule(payload: dict):
    world = payload.get("world")
    key = payload.get("key")
    value = payload.get("value")

    if not isinstance(world, str) or not world.strip():
        raise HTTPException(status_code=400, detail="world must be a non-empty string")
    if not isinstance(key, str) or not key.strip():
        raise HTTPException(status_code=400, detail="key must be a non-empty string")
    if isinstance(value, bool):
        pass
    elif not isinstance(value, int):
        raise HTTPException(status_code=400, detail="value must be boolean or integer")

    try:
        return await set_world_gamerule(world, key, value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


app.mount(
    "/dashboard",
    StaticFiles(directory=str(DASHBOARD_DIRECTORY), html=True),
    name="dashboard",
)
