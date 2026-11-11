from app.minecraft.protocol import call


async def get_bans() -> list:
    return await call("minecraft:bans")


async def add_ban(
    player: dict,
    reason: str = "Banned by server administrator",
    source: str = "Management API",
    expires: str | None = None,
) -> list:
    entry = {
        "player": {"name": player["name"]},
        "reason": reason,
        "source": source,
    }

    if expires is not None:
        entry["expires"] = expires

    return await call(
        "minecraft:bans/add",
        {
            "add": [entry],
        },
    )


async def remove_ban(player: dict) -> list:
    return await call(
        "minecraft:bans/remove",
        {
            "remove": [player],
        },
    )