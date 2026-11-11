from app.minecraft.protocol import call


async def get_gamerules() -> list:
    return await call("minecraft:gamerules")


async def update_gamerule(key: str, value):
    return await call(
        "minecraft:gamerules/update",
        {
            "gamerule": {
                "key": key,
                "value": value,
            }
        },
    )