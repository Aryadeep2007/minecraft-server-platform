from app.minecraft.protocol import call


async def get_players() -> list:
    return await call("minecraft:players")


async def kick_player(player: dict, message: str = "Kicked by server administrator") -> list:
    return await call(
        "minecraft:players/kick",
        {
            "kick": [
                {
                    "player": player,
                    "message": {
                        "literal": message,
                    },
                }
            ],
        },
    )