"""Exercise PaperManagementBridge + Multiverse on a disposable Paper server."""

import json
import os
import urllib.error
import urllib.request


BASE = "http://127.0.0.1:25586"
TOKEN = os.environ["BRIDGE_TOKEN"]
WORLD = "CodexCiLifecycle"


def request(path, payload=None, expected=200):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers=headers,
        method="GET" if body is None else "POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            status = response.status
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status = exc.code
        result = json.loads(exc.read().decode("utf-8"))
    if status != expected:
        raise AssertionError(f"{path}: expected HTTP {expected}, got {status}: {result}")
    return result


def confirmation(name):
    return {"name": name, "confirmed_name": name}


assert request("/health")["status"] == "ok"
primary = request("/worlds")["worlds"][0]["name"]
request("/worlds/archive", confirmation(primary), expected=409)
request("/worlds/load", confirmation("MissingCiWorld"), expected=404)
request(
    "/worlds/load",
    {"name": WORLD, "confirmed_name": "wrong"},
    expected=400,
)

created = request(
    "/worlds/create",
    {
        **confirmation(WORLD),
        "environment": "NORMAL",
        "world_type": "NORMAL",
        "game_mode": "SURVIVAL",
        "difficulty": "NORMAL",
        "generate_structures": False,
    },
)
assert created.get("world") == WORLD and created.get("loaded") is True, created

unloaded = request("/worlds/unload", confirmation(WORLD))
assert unloaded.get("loaded") is False, unloaded
loaded = request("/worlds/load", confirmation(WORLD))
assert loaded.get("loaded") is True, loaded

archived = request("/worlds/archive", confirmation(WORLD))
assert archived.get("archived") is True, archived
restored = request("/worlds/restore", confirmation(WORLD))
assert restored.get("archived") is False and restored.get("loaded") is False, restored

assert any(
    world.get("name") == WORLD
    for world in request("/multiverse/worlds")["worlds"]
)
request("/worlds/archive", confirmation(WORLD))
print("Disposable Paper lifecycle passed: create, load, unload, archive, restore, guards.")
