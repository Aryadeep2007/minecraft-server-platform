import asyncio
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

TOKEN_FILE = Path(
    os.environ.get(
        "MINECRAFT_BRIDGE_TOKEN_FILE",
        "/opt/minecraft-management/secrets/bridge-token",
    )
)


class BridgeConflictError(RuntimeError):
    """Raised when a world action conflicts with current server state."""


HEALTH_URL = "http://127.0.0.1:25586/health"


def _get_bridge_health() -> dict:
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        raise RuntimeError("Bridge token could not be read") from None

    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise RuntimeError("Bridge token configuration is invalid")

    request = Request(
        HEALTH_URL,
        headers={"Authorization": "Bearer " + token},
        method="GET",
    )

    try:
        with urlopen(request, timeout=3) as response:
            body = response.read()
    except HTTPError as exc:
        raise RuntimeError(
            f"Bridge returned HTTP {exc.code}"
        ) from None
    except (URLError, TimeoutError, OSError):
        raise RuntimeError("Bridge connection failed") from None

    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("Bridge returned invalid JSON") from None

    if not isinstance(result, dict) or result.get("status") != "ok":
        raise RuntimeError("Bridge health check failed")

    return result


async def get_bridge_health() -> dict:
    return await asyncio.to_thread(_get_bridge_health)


WORLD_URL = "http://127.0.0.1:25586/worlds"


def _get_worlds() -> dict:
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        raise RuntimeError("Bridge token could not be read") from None

    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise RuntimeError("Bridge token configuration is invalid")

    request = Request(
        WORLD_URL,
        headers={"Authorization": "Bearer " + token},
        method="GET",
    )

    try:
        with urlopen(request, timeout=5) as response:
            body = response.read()
    except HTTPError as exc:
        raise RuntimeError(
            f"Bridge returned HTTP {exc.code}"
        ) from None
    except (URLError, TimeoutError, OSError):
        raise RuntimeError("Bridge connection failed") from None

    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("Bridge returned invalid JSON") from None

    if not isinstance(result, dict) or not isinstance(result.get("worlds"), list):
        raise RuntimeError("Bridge returned an invalid world list")

    return result


async def get_worlds() -> dict:
    return await asyncio.to_thread(_get_worlds)


MULTIVERSE_WORLDS_URL = "http://127.0.0.1:25586/multiverse/worlds"


def _get_multiverse_worlds() -> dict:
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        raise RuntimeError("Bridge token could not be read") from None

    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise RuntimeError("Bridge token configuration is invalid")

    request = Request(
        MULTIVERSE_WORLDS_URL,
        headers={"Authorization": "Bearer " + token},
        method="GET",
    )

    try:
        with urlopen(request, timeout=5) as response:
            body = response.read()
    except HTTPError as exc:
        raise RuntimeError(
            f"Bridge returned HTTP {exc.code}"
        ) from None
    except (URLError, TimeoutError, OSError):
        raise RuntimeError("Bridge connection failed") from None

    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("Bridge returned invalid JSON") from None

    if not isinstance(result, dict) or not isinstance(result.get("worlds"), list):
        raise RuntimeError("Bridge returned an invalid Multiverse world list")

    for world in result["worlds"]:
        if (
            not isinstance(world, dict)
            or not isinstance(world.get("name"), str)
            or not isinstance(world.get("alias"), str)
            or not isinstance(world.get("environment"), str)
            or not isinstance(world.get("loaded"), bool)
        ):
            raise RuntimeError("Bridge returned invalid Multiverse world data")

    return result


async def get_multiverse_worlds() -> dict:
    return await asyncio.to_thread(_get_multiverse_worlds)


WORLD_GAMERULES_URL = "http://127.0.0.1:25586/worlds/gamerules"


def _bridge_request(
    url: str,
    method: str = "GET",
    payload: dict | None = None,
    timeout: float = 5,
) -> dict:
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        raise RuntimeError("Bridge token could not be read") from None

    if not re.fullmatch(r"[0-9a-fA-F]{64}", token):
        raise RuntimeError("Bridge token configuration is invalid")

    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": "Bearer " + token}
    if data is not None:
        headers["Content-Type"] = "application/json"

    request = Request(url, data=data, headers=headers, method=method)

    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            status = response.status
    except HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            detail = {}
        error = detail.get("error") if isinstance(detail, dict) else None
        if exc.code == 400:
            raise ValueError(error or "Invalid gamerule request") from None
        if exc.code == 404:
            raise LookupError(error or "World not loaded") from None
        if exc.code == 409:
            raise BridgeConflictError(error or "World action conflicts with current state") from None
        raise RuntimeError(f"Bridge returned HTTP {exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise RuntimeError("Bridge connection failed") from None

    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("Bridge returned invalid JSON") from None

    if not isinstance(result, dict):
        raise RuntimeError("Bridge returned an invalid response")
    return result


def _get_world_gamerules(world: str) -> dict:
    from urllib.parse import urlencode

    result = _bridge_request(
        WORLD_GAMERULES_URL + "?" + urlencode({"world": world})
    )
    if (
        result.get("world") != world
        or not isinstance(result.get("gamerules"), list)
    ):
        raise RuntimeError("Bridge returned invalid gamerule data")

    for rule in result["gamerules"]:
        if (
            not isinstance(rule, dict)
            or not isinstance(rule.get("key"), str)
            or rule.get("type") not in {"boolean", "integer", "string"}
            or "value" not in rule
        ):
            raise RuntimeError("Bridge returned invalid gamerule data")
    return result


async def get_world_gamerules(world: str) -> dict:
    return await asyncio.to_thread(_get_world_gamerules, world)


def _set_world_gamerule(world: str, key: str, value: bool | int) -> dict:
    result = _bridge_request(
        WORLD_GAMERULES_URL,
        method="PUT",
        payload={"world": world, "key": key, "value": value},
    )
    rule = result.get("gamerule")
    if (
        result.get("world") != world
        or not isinstance(rule, dict)
        or rule.get("key") != key
        or "value" not in rule
    ):
        raise RuntimeError("Bridge returned invalid gamerule update data")
    return result


async def set_world_gamerule(world: str, key: str, value: bool | int) -> dict:
    return await asyncio.to_thread(_set_world_gamerule, world, key, value)


WORLD_ACTION_URLS = {
    "load": "http://127.0.0.1:25586/worlds/load",
    "unload": "http://127.0.0.1:25586/worlds/unload",
    "create": "http://127.0.0.1:25586/worlds/create",
    "archive": "http://127.0.0.1:25586/worlds/archive",
    "restore": "http://127.0.0.1:25586/worlds/restore",
    "import": "http://127.0.0.1:25586/worlds/import",
}


def _world_action(action: str, payload: dict) -> dict:
    timeout = 185 if action == "create" else 65
    return _bridge_request(
        WORLD_ACTION_URLS[action],
        method="POST",
        payload=payload,
        timeout=timeout,
    )


async def load_world(name: str) -> dict:
    return await asyncio.to_thread(
        _world_action,
        "load",
        {"name": name, "confirmed_name": name},
    )


async def unload_world(name: str) -> dict:
    return await asyncio.to_thread(
        _world_action,
        "unload",
        {"name": name, "confirmed_name": name},
    )


async def create_world(payload: dict) -> dict:
    return await asyncio.to_thread(_world_action, "create", payload)


async def archive_world(name: str) -> dict:
    return await asyncio.to_thread(
        _world_action,
        "archive",
        {"name": name, "confirmed_name": name},
    )


async def restore_world(name: str) -> dict:
    return await asyncio.to_thread(
        _world_action,
        "restore",
        {"name": name, "confirmed_name": name},
    )


async def import_world_folder(name: str, environment: str) -> dict:
    return await asyncio.to_thread(
        _world_action,
        "import",
        {
            "name": name,
            "confirmed_name": name,
            "environment": environment,
        },
    )
