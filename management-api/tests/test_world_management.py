import asyncio
import os
import io
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from starlette.requests import Request

os.environ["MINECRAFT_DASHBOARD_DIRECTORY"] = str(
    Path(__file__).resolve().parents[2] / "web-dashboard"
)

from app import main
from app.services.bridge import BridgeConflictError


class WorldManagementValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_uppercase_world_name_matches_supported_name_pattern(self):
        self.assertTrue(main.validate_world_name("SummerBuild_2"))

    async def test_load_requires_exact_confirmation(self):
        with self.assertRaises(HTTPException) as raised:
            await main.load_world_route(
                {"name": "survival", "confirmed_name": "other"}
            )

        self.assertEqual(raised.exception.status_code, 400)

    async def test_path_traversal_name_is_rejected_before_bridge_call(self):
        with patch("app.main.load_world", new_callable=AsyncMock) as load:
            with self.assertRaises(HTTPException) as raised:
                await main.load_world_route(
                    {"name": "../escape", "confirmed_name": "../escape"}
                )

        self.assertEqual(raised.exception.status_code, 400)
        load.assert_not_awaited()

    async def test_load_passes_validated_name_to_bridge(self):
        with patch(
            "app.main.load_world",
            new_callable=AsyncMock,
            return_value={"world": "survival", "loaded": True},
        ) as load:
            result = await main.load_world_route(
                {"name": "survival", "confirmed_name": "survival"}
            )

        self.assertTrue(result["loaded"])
        load.assert_awaited_once_with("survival")

    async def test_unload_conflict_is_returned_as_http_409(self):
        with patch(
            "app.main.unload_world",
            new_callable=AsyncMock,
            side_effect=BridgeConflictError("world has players"),
        ):
            with self.assertRaises(HTTPException) as raised:
                await main.unload_world_route(
                    {"name": "survival", "confirmed_name": "survival"}
                )

        self.assertEqual(raised.exception.status_code, 409)

    async def test_create_rejects_unsupported_world_type(self):
        payload = valid_create_payload()
        payload["world_type"] = "CUSTOM_COMMAND"
        with patch("app.main.create_world", new_callable=AsyncMock) as create:
            with self.assertRaises(HTTPException) as raised:
                await main.create_world_route(payload)

        self.assertEqual(raised.exception.status_code, 400)
        create.assert_not_awaited()

    async def test_create_rejects_path_traversal_and_wrong_confirmation(self):
        for name, confirmed in (("../escape", "../escape"), ("safe", "other")):
            payload = valid_create_payload()
            payload["name"] = name
            payload["confirmed_name"] = confirmed
            with self.subTest(name=name, confirmed=confirmed):
                with self.assertRaises(HTTPException) as raised:
                    await main.create_world_route(payload)
                self.assertEqual(raised.exception.status_code, 400)

    async def test_create_requires_a_real_boolean_for_structures(self):
        payload = valid_create_payload()
        payload["generate_structures"] = "true"
        with patch("app.main.create_world", new_callable=AsyncMock) as create:
            with self.assertRaises(HTTPException) as raised:
                await main.create_world_route(payload)

        self.assertEqual(raised.exception.status_code, 400)
        create.assert_not_awaited()

    async def test_valid_create_payload_is_forwarded(self):
        payload = valid_create_payload()
        expected = {"world": "portfolio", "loaded": True}
        with patch(
            "app.main.create_world",
            new_callable=AsyncMock,
            return_value=expected,
        ) as create:
            result = await main.create_world_route(payload)

        self.assertEqual(result, expected)
        create.assert_awaited_once_with(payload)

    async def test_archive_requires_exact_confirmation(self):
        with patch("app.main.archive_world", new_callable=AsyncMock) as archive:
            with self.assertRaises(HTTPException) as raised:
                await main.archive_world_route(
                    {"name": "survival", "confirmed_name": "other"}
                )

        self.assertEqual(raised.exception.status_code, 400)
        archive.assert_not_awaited()


def valid_create_payload():
    return {
        "name": "portfolio",
        "confirmed_name": "portfolio",
        "environment": "NORMAL",
        "world_type": "NORMAL",
        "game_mode": "SURVIVAL",
        "difficulty": "NORMAL",
        "generate_structures": True,
    }


class WorldArchiveValidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.original_world_directory = main.WORLD_DIRECTORY
        main.WORLD_DIRECTORY = Path(self.temporary.name)

    def tearDown(self):
        main.WORLD_DIRECTORY = self.original_world_directory
        self.temporary.cleanup()

    def make_archive(self, entries):
        path = Path(self.temporary.name) / "upload.zip"
        with zipfile.ZipFile(path, "w") as archive:
            for name, contents in entries:
                archive.writestr(name, contents)
        return path

    def test_valid_world_archive_is_extracted_without_overwrite(self):
        archive = self.make_archive(
            [("level.dat", b"level"), ("region/r.0.0.mca", b"region")]
        )

        result = main._extract_world_archive(archive, "imported")

        self.assertEqual(result, Path(self.temporary.name) / "imported")
        self.assertEqual((result / "level.dat").read_bytes(), b"level")
        self.assertEqual((result / "region/r.0.0.mca").read_bytes(), b"region")

    def test_archive_path_traversal_is_rejected(self):
        archive = self.make_archive(
            [("level.dat", b"level"), ("../escaped.txt", b"no")]
        )

        with self.assertRaises(HTTPException) as raised:
            main._extract_world_archive(archive, "imported")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertFalse((Path(self.temporary.name).parent / "escaped.txt").exists())
        self.assertFalse((Path(self.temporary.name) / "imported").exists())

    def test_archive_duplicate_paths_are_rejected_case_insensitively(self):
        archive = self.make_archive(
            [("level.dat", b"one"), ("LEVEL.DAT", b"two")]
        )

        with self.assertRaises(HTTPException) as raised:
            main._extract_world_archive(archive, "imported")

        self.assertEqual(raised.exception.status_code, 400)

    def test_archive_symlinks_are_rejected(self):
        path = Path(self.temporary.name) / "symlink.zip"
        info = zipfile.ZipInfo("linked-level.dat")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("level.dat", b"level")
            archive.writestr(info, "outside")

        with self.assertRaises(HTTPException) as raised:
            main._extract_world_archive(path, "imported")

        self.assertEqual(raised.exception.status_code, 400)

    def test_invalid_world_payload_is_not_overwritten(self):
        archive = self.make_archive([("level.dat", b"level")])
        destination = Path(self.temporary.name) / "existing"
        destination.mkdir()
        marker = destination / "keep.txt"
        marker.write_text("keep", encoding="utf-8")

        with self.assertRaises(HTTPException) as raised:
            main._extract_world_archive(archive, "existing")

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(marker.read_text(encoding="utf-8"), "keep")

    def test_register_rejects_symlinked_level_dat(self):
        world = Path(self.temporary.name) / "existing"
        world.mkdir()
        outside = Path(self.temporary.name) / "outside-level.dat"
        outside.write_bytes(b"level")
        try:
            (world / "level.dat").symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("symlink creation is unavailable in this environment")

        async def run_route():
            with patch(
                "app.main.import_world_folder",
                new_callable=AsyncMock,
            ) as importer:
                with self.assertRaises(HTTPException) as raised:
                    await main.register_world_route(
                        {
                            "name": "existing",
                            "confirmed_name": "existing",
                            "environment": "NORMAL",
                        }
                    )
                importer.assert_not_awaited()
                return raised.exception

        error = asyncio.run(run_route())
        self.assertEqual(error.status_code, 400)

    def test_import_route_streams_valid_archive_and_registers_world(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("level.dat", b"level")
        body = buffer.getvalue()

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/worlds/import",
                "headers": [
                    (b"content-type", b"application/zip"),
                    (b"content-length", str(len(body)).encode()),
                    (b"x-world-name", b"imported"),
                    (b"x-world-confirmation", b"imported"),
                    (b"x-world-environment", b"NORMAL"),
                ],
                "query_string": b"",
                "scheme": "http",
                "server": ("testserver", 80),
                "client": ("testclient", 123),
            },
            receive,
        )

        async def run_route():
            with patch(
                "app.main.import_world_folder",
                new_callable=AsyncMock,
                return_value={"world": "imported", "loaded": True},
            ) as importer:
                result = await main.import_world_route(request)
                importer.assert_awaited_once_with("imported", "NORMAL")
                return result

        result = asyncio.run(run_route())
        self.assertTrue(result["loaded"])
        self.assertEqual(
            (Path(self.temporary.name) / "imported" / "level.dat").read_bytes(),
            b"level",
        )


if __name__ == "__main__":
    unittest.main()
