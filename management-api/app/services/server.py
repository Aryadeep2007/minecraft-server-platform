import subprocess

from app.minecraft.protocol import call


# Only these three server lifecycle actions are allowed through sudo.
ALLOWED_ACTIONS = {
    "start": "start",
    "stop": "stop",
    "restart": "restart",
}


async def get_minecraft_status() -> dict:
    return await call("minecraft:server/status")


def get_service_status() -> str:
    result = subprocess.run(
        ["systemctl", "is-active", "minecraft"],
        capture_output=True,
        text=True,
        check=False,
    )

    return result.stdout.strip() or "unknown"


def control_server(action: str) -> str:
    if action not in ALLOWED_ACTIONS:
        raise ValueError("Unsupported server action")

    result = subprocess.run(
        [
            "sudo",
            "-n",
            "/bin/systemctl",
            ALLOWED_ACTIONS[action],
            "minecraft.service",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        error = result.stderr.strip() or "systemctl command failed"
        raise RuntimeError(error)

    return get_service_status()