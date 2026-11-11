from app.minecraft.protocol import call


async def get_ip_bans() -> list:
    return await call("minecraft:ip_bans")


async def add_ip_ban(
    ip: str,
    reason: str = "IP banned by server administrator",
    source: str = "Management API",
    expires: str | None = None,
) -> list:
    entry = {
        "ip": ip,
        "reason": reason,
        "source": source,
    }

    if expires is not None:
        entry["expires"] = expires

    return await call(
        "minecraft:ip_bans/add",
        {
            "add": [entry],
        },
    )


async def remove_ip_ban(ip: str) -> list:
    return await call(
        "minecraft:ip_bans/remove",
        {
            "ip": [ip],
        },
    )