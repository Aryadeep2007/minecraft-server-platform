package io.github.aryadeep2007.managementbridge;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BridgeHttpServerValidationTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void acceptsSafeWorldNamesIncludingUppercase() {
        assertTrue(BridgeHttpServer.validWorldName("world"));
        assertTrue(BridgeHttpServer.validWorldName("World_2"));
        assertTrue(BridgeHttpServer.validWorldName("world-name.v2"));
        assertTrue(BridgeHttpServer.validWorldName("A".repeat(32)));
    }

    @Test
    void rejectsUnsafeOrUnsupportedWorldNames() {
        assertFalse(BridgeHttpServer.validWorldName(null));
        assertFalse(BridgeHttpServer.validWorldName(""));
        assertFalse(BridgeHttpServer.validWorldName("../world"));
        assertFalse(BridgeHttpServer.validWorldName("world/name"));
        assertFalse(BridgeHttpServer.validWorldName("world name"));
        assertFalse(BridgeHttpServer.validWorldName("A".repeat(33)));
    }

    @Test
    void confirmedWorldNameRequiresExactMatch() {
        JsonObject payload = new JsonObject();
        payload.addProperty("name", "World_2");
        payload.addProperty("confirmed_name", "World_2");

        assertEquals("World_2", BridgeHttpServer.confirmedWorldName(payload));
    }

    @Test
    void confirmedWorldNameRejectsMismatchAndExtraFields() {
        JsonObject mismatch = new JsonObject();
        mismatch.addProperty("name", "World_2");
        mismatch.addProperty("confirmed_name", "world_2");
        assertNull(BridgeHttpServer.confirmedWorldName(mismatch));

        mismatch.addProperty("unexpected", true);
        assertNull(BridgeHttpServer.confirmedWorldName(mismatch));
    }

    @Test
    void confirmedWorldNameRejectsNonStringValues() {
        JsonObject payload = new JsonObject();
        payload.addProperty("name", "World_2");
        payload.addProperty("confirmed_name", 2);

        assertNull(BridgeHttpServer.confirmedWorldName(payload));
    }

    @Test
    void acceptsOnlyARealWorldDirectoryWithRegularLevelData() throws IOException {
        Path world = Files.createDirectory(temporaryDirectory.resolve("world"));
        Files.write(world.resolve("level.dat"), new byte[]{1});

        assertTrue(BridgeHttpServer.isSafeWorldDirectory(temporaryDirectory, "world"));
        assertFalse(BridgeHttpServer.isSafeWorldDirectory(temporaryDirectory, "missing"));
        assertFalse(BridgeHttpServer.isSafeWorldDirectory(temporaryDirectory, "../world"));
    }

    @Test
    void rejectsSymbolicLinkAsWorldDirectory() throws IOException {
        Path target = Files.createDirectory(temporaryDirectory.resolve("target"));
        Files.write(target.resolve("level.dat"), new byte[]{1});
        Path link = temporaryDirectory.resolve("world");
        createSymlinkOrSkip(link, target);

        assertFalse(BridgeHttpServer.isSafeWorldDirectory(temporaryDirectory, "world"));
    }

    @Test
    void rejectsSymbolicLinkAsLevelData() throws IOException {
        Path world = Files.createDirectory(temporaryDirectory.resolve("world"));
        Path target = temporaryDirectory.resolve("level-data-target");
        Files.write(target, new byte[]{1});
        createSymlinkOrSkip(world.resolve("level.dat"), target);

        assertFalse(BridgeHttpServer.isSafeWorldDirectory(temporaryDirectory, "world"));
    }

    private static void createSymlinkOrSkip(Path link, Path target) {
        try {
            Files.createSymbolicLink(link, target);
        } catch (IOException | UnsupportedOperationException | SecurityException exception) {
            Assumptions.abort("Symbolic link creation is unavailable on this system");
        }
    }
}
