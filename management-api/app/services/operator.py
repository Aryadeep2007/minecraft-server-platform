from app.minecraft.protocol import call


async def get_operators() -> list:
    return await call("minecraft:operators")


async def add_operator(operator: dict) -> list:
    return await call(
        "minecraft:operators/add",
        {
            "add": [operator],
        },
    )


async def remove_operator(player: dict) -> list:
    return await call(
        "minecraft:operators/remove",
        {
            "remove": [player],
        },
    )