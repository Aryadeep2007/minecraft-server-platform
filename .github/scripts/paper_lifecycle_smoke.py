"""Exercise PaperManagementBridge + Multiverse on a disposable Paper server."""

import json
import os
import shutil
import urllib.error
import urllib.request
from pathlib import Path


BASE = "http://127.0.0.1:25586"
TOKEN = os.environ["BRIDGE_TOKEN"]
WORLD = "CodexCiLifecycle"
IMPORTED_WORLD = "CodexCiImported"
SERVER_DIR = Path(".ci-paper")


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

# Use a real, disposable Paper world as the import fixture. The source world is
# unloaded before copying so its files are stable. A fresh folder name verifies
# Multiverse registration against an existing, structurally valid level.dat.
source_folder = SERVER_DIR / WORLD
import_folder = SERVER_DIR / IMPORTED_WORLD
shutil.copytree(source_folder, import_folder)
for transient in ("uid.dat", "session.lock"):
    (import_folder / transient).unlink(missing_ok=True)
imported = request(
    "/worlds/import",
    {
        "name": IMPORTED_WORLD,
        "confirmed_name": IMPORTED_WORLD,
        "environment": "NORMAL",
    },
)
assert imported.get("world") == IMPORTED_WORLD and imported.get("loaded") is True, imported
assert any(
    world.get("name") == IMPORTED_WORLD
    for world in request("/multiverse/worlds")["worlds"]
)

request("/worlds/unload", confirmation(IMPORTED_WORLD))

# A symlink archive container must be rejected before the source world moves.
trash = SERVER_DIR / ".management-world-trash"
trash.symlink_to(SERVER_DIR, target_is_directory=True)
try:
    request("/worlds/archive", confirmation(IMPORTED_WORLD), expected=409)
    assert import_folder.is_dir()
finally:
    trash.unlink(missing_ok=True)

archived_import = request("/worlds/archive", confirmation(IMPORTED_WORLD))
assert archived_import.get("archived") is True, archived_import
archive_root = trash / IMPORTED_WORLD
metadata = trash / f"{IMPORTED_WORLD}.json"
original_metadata = metadata.read_bytes()
metadata.write_text("{}", encoding="utf-8")
request("/worlds/restore", confirmation(IMPORTED_WORLD), expected=409)
assert archive_root.is_dir() and not import_folder.exists()
metadata.write_bytes(original_metadata)
restored_import = request("/worlds/restore", confirmation(IMPORTED_WORLD))
assert restored_import.get("archived") is False, restored_import
assert import_folder.is_dir()

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
request("/worlds/archive", confirmation(IMPORTED_WORLD))
print(
    "Disposable Paper lifecycle passed: create, import/register, load, unload, "
    "archive, restore, guards, and restore rejection recovery."
)
