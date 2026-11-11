import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from starlette.requests import Request
from starlette.responses import Response

os.environ.setdefault(
    "MINECRAFT_DASHBOARD_DIRECTORY",
    str(Path(__file__).resolve().parents[2] / "web-dashboard"),
)

from app import main


class DashboardAccessControlTests(unittest.IsolatedAsyncioTestCase):
    async def invoke_middleware(self, method="GET", headers=(), allowlist="owner-login"):
        with tempfile.TemporaryDirectory() as temporary:
            allowlist_file = Path(temporary) / "allowed-users.txt"
            allowlist_file.write_text(allowlist, encoding="utf-8")
            scope = {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": method,
                "scheme": "http",
                "path": "/test",
                "raw_path": b"/test",
                "query_string": b"",
                "root_path": "",
                "headers": list(headers),
                "client": ("127.0.0.1", 12345),
                "server": ("test", 8000),
            }
            request = Request(scope)
            next_response = Response(status_code=204)
            call_next = AsyncMock(return_value=next_response)

            with (
                patch.object(main, "DASHBOARD_ALLOWLIST", allowlist_file),
                patch.object(main, "DASHBOARD_ORIGIN", "https://dashboard.example.invalid"),
            ):
                result = await main.require_tailscale_allowlist(request, call_next)

        return result, call_next

    async def test_missing_identity_is_denied_before_route(self):
        response, call_next = await self.invoke_middleware()

        self.assertEqual(response.status_code, 403)
        call_next.assert_not_awaited()

    async def test_identity_not_in_allowlist_is_denied(self):
        response, call_next = await self.invoke_middleware(
            headers=[(b"tailscale-user-login", b"other-login")]
        )

        self.assertEqual(response.status_code, 403)
        call_next.assert_not_awaited()

    async def test_allowlisted_identity_is_case_insensitive(self):
        response, call_next = await self.invoke_middleware(
            headers=[(b"tailscale-user-login", b"OWNER-LOGIN")]
        )

        self.assertEqual(response.status_code, 204)
        call_next.assert_awaited_once()

    async def test_write_without_matching_origin_is_denied(self):
        response, call_next = await self.invoke_middleware(
            method="POST",
            headers=[(b"tailscale-user-login", b"owner-login")],
        )

        self.assertEqual(response.status_code, 403)
        call_next.assert_not_awaited()

    async def test_write_with_matching_origin_is_allowed(self):
        response, call_next = await self.invoke_middleware(
            method="POST",
            headers=[
                (b"tailscale-user-login", b"owner-login"),
                (b"origin", b"https://dashboard.example.invalid/"),
            ],
        )

        self.assertEqual(response.status_code, 204)
        call_next.assert_awaited_once()

    async def test_unavailable_allowlist_fails_closed(self):
        request = Request({
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/test",
            "raw_path": b"/test",
            "query_string": b"",
            "root_path": "",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("test", 8000),
        })
        call_next = AsyncMock(return_value=Response(status_code=204))
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(
                main,
                "DASHBOARD_ALLOWLIST",
                Path(temporary) / "missing-allowlist.txt",
            ):
                response = await main.require_tailscale_allowlist(request, call_next)

        self.assertEqual(response.status_code, 503)
        call_next.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
