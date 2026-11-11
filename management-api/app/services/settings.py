from app.minecraft.protocol import call


async def get_difficulty() -> dict:
    return await call("minecraft:serversettings/difficulty")


async def get_game_mode() -> dict:
    return await call("minecraft:serversettings/game_mode")


async def set_difficulty(difficulty: str) -> dict:
    return await call(
        "minecraft:serversettings/difficulty/set",
        {
            "difficulty": difficulty,
        },
    )


async def set_game_mode(mode: str) -> dict:
    return await call(
        "minecraft:serversettings/game_mode/set",
        {
            "mode": mode,
        },
    )


async def get_enforce_allowlist() -> dict:
    return await call("minecraft:serversettings/enforce_allowlist")


async def set_enforce_allowlist(enforce: bool) -> dict:
    return await call(
        "minecraft:serversettings/enforce_allowlist/set",
        {
            "enforce": enforce,
        },
    )


async def get_use_allowlist() -> dict:
    return await call("minecraft:serversettings/use_allowlist")


async def set_use_allowlist(use: bool) -> dict:
    return await call(
        "minecraft:serversettings/use_allowlist/set",
        {
            "use": use,
        },
    )


async def get_autosave() -> dict:
    return await call("minecraft:serversettings/autosave")


async def set_autosave(enable: bool) -> dict:
    return await call(
        "minecraft:serversettings/autosave/set",
        {
            "enable": enable,
        },
    )