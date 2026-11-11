"""Isolated ASGI-level dashboard write tests with a mocked Paper bridge."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app import main


class DashboardWriteAsgiTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, method, path, payload, origin):
        body = json.dumps(payload).encode("utf-8") if payload is not None else b""
        messages = []
        received = False

        async def receive():
            nonlocal received
            if received:
                return {"type": "http.request", "body": b"", "more_body": False}
            received = True
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "root_path": "",
            "headers": [
                (b"content-type", b"application/json"),
                (b"tailscale-user-login", b"test-owner@example.invalid"),
                (b"origin", origin.encode("ascii")),
            ],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }
        await main.app(scope, receive, send)
        start = next(item for item in messages if item["type"] == "http.response.start")
        chunks = [item.get("body", b"") for item in messages if item["type"] == "http.response.body"]
        response_body = b"".join(chunks)
        return start["status"], json.loads(response_body) if response_body else None

    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        allowlist = Path(self.temporary.name) / "allowlist.txt"
        allowlist.write_text("test-owner@example.invalid\n", encoding="utf-8")
        self.allowlist_patch = patch.object(main, "DASHBOARD_ALLOWLIST", allowlist)
        self.origin_patch = patch.object(main, "DASHBOARD_ORIGIN", "http://testserver")
        self.allowlist_patch.start()
        self.origin_patch.start()

    async def asyncTearDown(self):
        self.origin_patch.stop()
        self.allowlist_patch.stop()
        self.temporary.cleanup()

    async def test_authenticated_create_reaches_only_mock_bridge(self):
        payload = {
            "name": "DisposableWorld",
            "confirmed_name": "DisposableWorld",
            "environment": "NORMAL",
            "world_type": "NORMAL",
            "game_mode": "SURVIVAL",
            "difficulty": "NORMAL",
            "generate_structures": True,
        }
        with patch(
            "app.main.create_world",
            new_callable=AsyncMock,
            return_value={"world": "DisposableWorld", "created": True},
        ) as mock_bridge:
            status, response = await self.request(
                "POST", "/worlds/create", payload, "http://testserver"
            )

        self.assertEqual(status, 200)
        self.assertTrue(response["created"])
        mock_bridge.assert_awaited_once_with(payload)

    async def test_cross_origin_create_is_rejected_before_bridge_call(self):
        payload = {
            "name": "DisposableWorld",
            "confirmed_name": "DisposableWorld",
            "environment": "NORMAL",
            "world_type": "NORMAL",
            "game_mode": "SURVIVAL",
            "difficulty": "NORMAL",
            "generate_structures": True,
        }
        with patch("app.main.create_world", new_callable=AsyncMock) as mock_bridge:
            status, response = await self.request(
                "POST", "/worlds/create", payload, "https://attacker.invalid"
            )

        self.assertEqual(status, 403)
        self.assertIn("Cross-origin", response["detail"])
        mock_bridge.assert_not_awaited()

    async def test_authenticated_lifecycle_actions_reach_only_mock_bridge(self):
        actions = (
            ("/worlds/load", "load_world", {"world": "DisposableWorld", "loaded": True}),
            ("/worlds/unload", "unload_world", {"world": "DisposableWorld", "loaded": False}),
            ("/worlds/archive", "archive_world", {"world": "DisposableWorld", "archived": True}),
            ("/worlds/restore", "restore_world", {"world": "DisposableWorld", "archived": False}),
        )
        payload = {"name": "DisposableWorld", "confirmed_name": "DisposableWorld"}

        for path, bridge_method, result in actions:
            with self.subTest(path=path):
                with patch(
                    f"app.main.{bridge_method}",
                    new_callable=AsyncMock,
                    return_value=result,
                ) as mock_bridge:
                    status, response = await self.request(
                        "POST", path, payload, "http://testserver"
                    )

                self.assertEqual(status, 200)
                self.assertEqual(response, result)
                mock_bridge.assert_awaited_once_with("DisposableWorld")


if __name__ == "__main__":
    unittest.main()
