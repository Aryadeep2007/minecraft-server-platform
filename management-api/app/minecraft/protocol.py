import json
import os
from pathlib import Path

import websockets


SERVER_PROPERTIES = Path(
    os.environ.get(
        "MINECRAFT_SERVER_PROPERTIES_FILE",
        "/opt/minecraft/server.properties",
    )
)
MANAGEMENT_URI = "ws://127.0.0.1:25585"


def _read_management_secret() -> str:
    for line in SERVER_PROPERTIES.read_text(encoding="utf-8").splitlines():
        if line.startswith("management-server-secret="):
            secret = line.split("=", 1)[1].strip()

            if len(secret) != 40 or not secret.isalnum():
                raise RuntimeError("Invalid Management Protocol secret")

            return secret

    raise RuntimeError("Management Protocol secret not found")


async def call(method: str, params=None):
    secret = _read_management_secret()

    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
    }

    if params is not None:
        request["params"] = params

    async with websockets.connect(
        MANAGEMENT_URI,
        additional_headers={"Authorization": f"Bearer {secret}"},
        proxy=None,
    ) as websocket:
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())

    if "error" in response:
        error = response["error"]
        message = error.get("message", "Management Protocol error")
        raise RuntimeError(message)

    return response.get("result")
