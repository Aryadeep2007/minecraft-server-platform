from app.minecraft.protocol import call


async def get_allowlist() -> list:
    return await call("minecraft:allowlist")


async def add_to_allowlist(player: dict) -> list:
    return await call(
        "minecraft:allowlist/add",
        {
            "add": [player],
        },
    )


async def remove_from_allowlist(player: dict) -> list:
    return await call(
        "minecraft:allowlist/remove",
        {
            "remove": [player],
        },
    )