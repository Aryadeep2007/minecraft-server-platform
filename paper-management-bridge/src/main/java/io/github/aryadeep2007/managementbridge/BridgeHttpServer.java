package io.github.aryadeep2007.managementbridge;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import org.bukkit.GameRule;
import org.bukkit.Difficulty;
import org.bukkit.GameMode;
import org.bukkit.Registry;
import org.bukkit.World;
import org.bukkit.WorldType;
import org.bukkit.plugin.java.JavaPlugin;
import org.mvplugins.multiverse.core.MultiverseCoreApi;
import org.mvplugins.multiverse.core.world.LoadedMultiverseWorld;
import org.mvplugins.multiverse.core.world.MultiverseWorld;
import org.mvplugins.multiverse.core.world.options.CreateWorldOptions;
import org.mvplugins.multiverse.core.world.options.ImportWorldOptions;
import org.mvplugins.multiverse.core.world.options.LoadWorldOptions;
import org.mvplugins.multiverse.core.world.options.UnloadWorldOptions;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

public final class BridgeHttpServer {

    private static final String TOKEN_FILE =
            "/opt/minecraft-management/secrets/bridge-token";
    private static final int PORT = 25586;
    private static final Gson GSON = new Gson();
    private static final Pattern WORLD_NAME =
            Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,31}");

    private final JavaPlugin plugin;
    private HttpServer server;
    private ExecutorService executor;
    private byte[] expectedToken;

    public BridgeHttpServer(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void start() throws IOException {
        String token = Files.readString(
                Path.of(TOKEN_FILE), StandardCharsets.UTF_8
        ).trim();

        if (!token.matches("[0-9a-fA-F]{64}")) {
            throw new IOException(
                    "Bridge token must contain exactly 64 hexadecimal characters."
            );
        }

        expectedToken = token.getBytes(StandardCharsets.UTF_8);

        server = HttpServer.create(
                new InetSocketAddress(
                        InetAddress.getByName("127.0.0.1"), PORT
                ), 0
        );

        executor = Executors.newFixedThreadPool(2, task -> {
            Thread thread = new Thread(task, "paper-management-bridge-http");
            thread.setDaemon(true);
            return thread;
        });

        server.setExecutor(executor);
        server.createContext("/", this::handleRequest);
        server.start();

        plugin.getLogger().info(
                "Authenticated management bridge listening on 127.0.0.1:" + PORT
        );
    }

    private void handleRequest(HttpExchange exchange) throws IOException {
        try {
            String authorization =
                    exchange.getRequestHeaders().getFirst("Authorization");

            String prefix = "Bearer ";
            if (authorization == null || !authorization.startsWith(prefix)) {
                sendJson(exchange, 401, "{\"error\":\"unauthorized\"}");
                return;
            }

            byte[] suppliedToken = authorization.substring(prefix.length())
                    .getBytes(StandardCharsets.UTF_8);

            if (!MessageDigest.isEqual(expectedToken, suppliedToken)) {
                sendJson(exchange, 401, "{\"error\":\"unauthorized\"}");
                return;
            }

            String path = exchange.getRequestURI().getPath();
            boolean worldAction = "/worlds/load".equals(path)
                    || "/worlds/unload".equals(path)
                    || "/worlds/create".equals(path)
                    || "/worlds/archive".equals(path)
                    || "/worlds/restore".equals(path)
                    || "/worlds/import".equals(path);

            if (!"/health".equals(path)
                    && !"/worlds".equals(path)
                    && !"/multiverse/worlds".equals(path)
                    && !"/worlds/gamerules".equals(path)
                    && !worldAction) {
                sendJson(exchange, 404, "{\"error\":\"not_found\"}");
                return;
            }

            if (!"/worlds/gamerules".equals(path)
                    && !worldAction
                    && !"GET".equals(exchange.getRequestMethod())) {
                sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
                return;
            }

            if (worldAction && !"POST".equals(exchange.getRequestMethod())) {
                sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
                return;
            }

            if ("/health".equals(path)) {
                sendJson(
                        exchange, 200,
                        "{\"status\":\"ok\",\"bridge\":\"PaperManagementBridge\"}"
                );
                return;
            }

            if ("/worlds/gamerules".equals(path)) {
                handleWorldGamerulesRequest(exchange);
                return;
            }

            if (worldAction) {
                handleWorldActionRequest(exchange, path);
                return;
            }

            try {
                if ("/multiverse/worlds".equals(path)) {
                    sendJson(exchange, 200, getMultiverseWorldsJson());
                } else {
                    sendJson(exchange, 200, getWorldsJson());
                }
            } catch (IllegalStateException exception) {
                sendJson(exchange, 503, "{\"error\":\"multiverse_unavailable\"}");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                sendJson(exchange, 503, "{\"error\":\"request_interrupted\"}");
            } catch (ExecutionException | TimeoutException exception) {
                plugin.getLogger().warning(
                        "World-list request failed: "
                                + exception.getClass().getSimpleName()
                );
                sendJson(exchange, 503, "{\"error\":\"world_list_unavailable\"}");
            }
        } finally {
            exchange.close();
        }
    }

    private String getWorldsJson()
            throws InterruptedException, ExecutionException, TimeoutException {
        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            StringBuilder json = new StringBuilder("{\"worlds\":[");
            boolean first = true;

            for (World world : plugin.getServer().getWorlds()) {
                if (!first) {
                    json.append(',');
                }
                first = false;

                json.append("{\"name\":\"")
                        .append(jsonEscape(world.getName()))
                        .append("\",\"environment\":\"")
                        .append(world.getEnvironment().name())
                        .append("\",\"players\":")
                        .append(world.getPlayers().size())
                        .append('}');
            }

            return json.append("]}").toString();
        }).get(3, TimeUnit.SECONDS);
    }

    private void handleWorldActionRequest(
            HttpExchange exchange, String path
    ) throws IOException {
        JsonObject payload;
        try {
            payload = readJsonObject(exchange);
        } catch (JsonParseException | IllegalArgumentException exception) {
            sendJson(exchange, 400, "{\"error\":\"invalid_json_request\"}");
            return;
        }

        try {
            BridgeResponse response;
            if ("/worlds/load".equals(path)) {
                response = loadWorld(payload);
            } else if ("/worlds/unload".equals(path)) {
                response = unloadWorld(payload);
            } else if ("/worlds/create".equals(path)) {
                response = createWorld(payload);
            } else if ("/worlds/archive".equals(path)) {
                response = archiveWorld(payload);
            } else if ("/worlds/restore".equals(path)) {
                response = restoreWorld(payload);
            } else {
                response = importWorld(payload);
            }
            sendJson(exchange, response.status(), response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            sendJson(exchange, 503, "{\"error\":\"world_action_interrupted\"}");
        } catch (ExecutionException exception) {
            plugin.getLogger().warning(
                    "World action failed: "
                            + exception.getCause().getClass().getSimpleName()
            );
            sendJson(exchange, 503, "{\"error\":\"world_action_unavailable\"}");
        } catch (TimeoutException exception) {
            sendJson(exchange, 504, "{\"error\":\"world_action_timed_out\"}");
        }
    }

    private BridgeResponse loadWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        String name = confirmedWorldName(payload);
        if (name == null) {
            return errorResponse(400, "invalid_world_confirmation");
        }

        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            MultiverseWorld world = manager.getWorld(name)
                    .getOrElse((MultiverseWorld) null);
            if (world == null) {
                return errorResponse(404, "world_not_registered");
            }
            if (world.isLoaded()) {
                return errorResponse(409, "world_already_loaded");
            }

            var result = manager.loadWorld(LoadWorldOptions.world(world));
            if (result.isFailure()) {
                return errorResponse(409, "world_load_rejected");
            }
            return worldActionResponse(name, true, "loaded");
        }).get(30, TimeUnit.SECONDS);
    }

    private BridgeResponse unloadWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        String name = confirmedWorldName(payload);
        if (name == null) {
            return errorResponse(400, "invalid_world_confirmation");
        }

        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            LoadedMultiverseWorld world = manager.getLoadedWorld(name)
                    .getOrElse((LoadedMultiverseWorld) null);
            if (world == null) {
                return errorResponse(409, "world_not_loaded");
            }

            var bukkitWorld = world.getBukkitWorld()
                    .getOrElse((World) null);
            if (bukkitWorld == null) {
                return errorResponse(409, "world_unavailable");
            }
            if (!plugin.getServer().getWorlds().isEmpty()
                    && plugin.getServer().getWorlds().get(0).getName().equals(name)) {
                return errorResponse(409, "primary_world_protected");
            }
            if (!bukkitWorld.getPlayers().isEmpty()) {
                return errorResponse(409, "world_has_players");
            }

            var result = manager.unloadWorld(
                    UnloadWorldOptions.world(world)
                            .saveBukkitWorld(true)
                            .unloadBukkitWorld(true)
            );
            if (result.isFailure()) {
                return errorResponse(409, "world_unload_rejected");
            }
            return worldActionResponse(name, false, "unloaded");
        }).get(30, TimeUnit.SECONDS);
    }

    private BridgeResponse createWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        if (payload.size() != 7
                || !payload.has("name")
                || !payload.has("confirmed_name")
                || !payload.has("environment")
                || !payload.has("world_type")
                || !payload.has("game_mode")
                || !payload.has("difficulty")
                || !payload.has("generate_structures")) {
            return errorResponse(400, "invalid_world_create_payload");
        }

        String name = stringValue(payload, "name");
        String confirmed = stringValue(payload, "confirmed_name");
        String environmentValue = stringValue(payload, "environment");
        String worldTypeValue = stringValue(payload, "world_type");
        String gameModeValue = stringValue(payload, "game_mode");
        String difficultyValue = stringValue(payload, "difficulty");
        JsonElement structuresValue = payload.get("generate_structures");
        if (!validWorldName(name)
                || !name.equals(confirmed)
                || environmentValue == null
                || worldTypeValue == null
                || gameModeValue == null
                || difficultyValue == null
                || !structuresValue.isJsonPrimitive()
                || !structuresValue.getAsJsonPrimitive().isBoolean()) {
            return errorResponse(400, "invalid_world_create_payload");
        }

        World.Environment environment;
        WorldType worldType;
        GameMode gameMode;
        Difficulty difficulty;
        try {
            environment = World.Environment.valueOf(environmentValue);
            worldType = WorldType.valueOf(worldTypeValue);
            gameMode = GameMode.valueOf(gameModeValue);
            difficulty = Difficulty.valueOf(difficultyValue);
        } catch (IllegalArgumentException exception) {
            return errorResponse(400, "unsupported_world_setting");
        }
        if (environment == World.Environment.CUSTOM) {
            return errorResponse(400, "unsupported_world_environment");
        }

        boolean generateStructures = structuresValue.getAsBoolean();
        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            Path worldFolder = plugin.getServer().getWorldContainer().toPath()
                    .resolve(name);
            if (manager.isWorld(name)
                    || Files.exists(worldFolder, LinkOption.NOFOLLOW_LINKS)) {
                return errorResponse(409, "world_name_already_exists");
            }

            var result = manager.createWorld(
                    CreateWorldOptions.worldName(name)
                            .environment(environment)
                            .worldType(worldType)
                            .generateStructures(generateStructures)
                            .doFolderCheck(true)
            );
            if (result.isFailure()) {
                return errorResponse(409, "world_create_rejected");
            }

            LoadedMultiverseWorld created = result.get();
            boolean gameModeSet = created.setGameMode(gameMode).isSuccess();
            boolean difficultySet = created.setDifficulty(difficulty).isSuccess();
            if (!gameModeSet || !difficultySet) {
                plugin.getLogger().warning(
                        "Created world settings could not be fully applied: " + name
                );
                return errorResponse(503, "world_settings_update_failed");
            }
            return worldActionResponse(name, true, "created");
        }).get(180, TimeUnit.SECONDS);
    }

    private BridgeResponse archiveWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        String name = confirmedWorldName(payload);
        if (name == null) {
            return errorResponse(400, "invalid_world_confirmation");
        }

        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            MultiverseWorld world = manager.getWorld(name)
                    .getOrElse((MultiverseWorld) null);
            if (world == null) {
                return errorResponse(404, "world_not_registered");
            }
            if (!plugin.getServer().getWorlds().isEmpty()
                    && plugin.getServer().getWorlds().get(0).getName().equals(name)) {
                return errorResponse(409, "primary_world_protected");
            }

            Path root = plugin.getServer().getWorldContainer().toPath().toRealPath();
            Path source = root.resolve(name).normalize();
            if (!isSafeWorldDirectory(root, name)) {
                return errorResponse(404, "world_folder_not_found");
            }

            Path trash = root.resolve(".management-world-trash");
            if (Files.exists(trash, LinkOption.NOFOLLOW_LINKS)
                    && (Files.isSymbolicLink(trash)
                    || !Files.isDirectory(trash, LinkOption.NOFOLLOW_LINKS))) {
                return errorResponse(409, "world_archive_directory_invalid");
            }
            if (!Files.exists(trash, LinkOption.NOFOLLOW_LINKS)) {
                Files.createDirectory(trash);
            }
            Path realTrash = trash.toRealPath();
            if (!root.equals(realTrash.getParent())) {
                return errorResponse(409, "world_archive_directory_invalid");
            }
            Path destination = realTrash.resolve(name);
            Path metadata = realTrash.resolve(name + ".json");
            if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)
                    || Files.exists(metadata, LinkOption.NOFOLLOW_LINKS)) {
                return errorResponse(409, "world_already_archived");
            }

            if (world.isLoaded()) {
                LoadedMultiverseWorld loaded = manager.getLoadedWorld(name)
                        .getOrElse((LoadedMultiverseWorld) null);
                World bukkitWorld = loaded == null
                        ? null
                        : loaded.getBukkitWorld().getOrElse((World) null);
                if (bukkitWorld == null) {
                    return errorResponse(409, "world_unavailable");
                }
                if (!bukkitWorld.getPlayers().isEmpty()) {
                    return errorResponse(409, "world_has_players");
                }
                var unload = manager.unloadWorld(
                        UnloadWorldOptions.world(loaded)
                                .saveBukkitWorld(true)
                                .unloadBukkitWorld(true)
                );
                if (unload.isFailure()) {
                    return errorResponse(409, "world_unload_rejected");
                }
            }

            boolean wasAutoLoad = world.isAutoLoad();
            if (world.setAutoLoad(false).isFailure()
                    || manager.saveWorldsConfig().isFailure()) {
                world.setAutoLoad(wasAutoLoad);
                manager.saveWorldsConfig();
                return errorResponse(503, "world_autoload_update_failed");
            }
            try {
                Files.move(source, destination);
                JsonObject archiveMetadata = new JsonObject();
                archiveMetadata.addProperty("auto_load", wasAutoLoad);
                Files.writeString(
                        metadata,
                        GSON.toJson(archiveMetadata),
                        StandardCharsets.UTF_8
                );
            } catch (IOException exception) {
                try {
                    Files.deleteIfExists(metadata);
                } catch (IOException cleanupException) {
                    plugin.getLogger().warning(
                            "Could not remove incomplete world archive metadata."
                    );
                }
                if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)
                        && !Files.exists(source, LinkOption.NOFOLLOW_LINKS)) {
                    Files.move(destination, source);
                }
                world.setAutoLoad(wasAutoLoad);
                manager.saveWorldsConfig();
                return errorResponse(503, "world_archive_failed");
            }
            JsonObject body = new JsonObject();
            body.addProperty("world", name);
            body.addProperty("loaded", false);
            body.addProperty("archived", true);
            body.addProperty("action", "archived");
            return new BridgeResponse(200, GSON.toJson(body));
        }).get(60, TimeUnit.SECONDS);
    }

    private BridgeResponse restoreWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        String name = confirmedWorldName(payload);
        if (name == null) {
            return errorResponse(400, "invalid_world_confirmation");
        }

        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            if (!manager.isWorld(name)) {
                return errorResponse(404, "world_not_registered");
            }

            Path root = plugin.getServer().getWorldContainer().toPath().toRealPath();
            Path trash = root.resolve(".management-world-trash");
            if (Files.isSymbolicLink(trash)
                    || !Files.isDirectory(trash, LinkOption.NOFOLLOW_LINKS)) {
                return errorResponse(404, "world_archive_not_found");
            }
            Path realTrash = trash.toRealPath();
            if (!root.equals(realTrash.getParent())) {
                return errorResponse(409, "world_archive_directory_invalid");
            }
            Path source = realTrash.resolve(name);
            Path destination = root.resolve(name).normalize();
            Path metadata = realTrash.resolve(name + ".json");
            if (!destination.getParent().equals(root)
                    || !isSafeWorldDirectory(realTrash, name)) {
                return errorResponse(404, "world_archive_not_found");
            }
            if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)) {
                return errorResponse(409, "world_folder_already_exists");
            }

            boolean autoLoad = false;
            if (Files.exists(metadata, LinkOption.NOFOLLOW_LINKS)) {
                if (Files.isSymbolicLink(metadata)
                        || !Files.isRegularFile(metadata, LinkOption.NOFOLLOW_LINKS)) {
                    return errorResponse(409, "world_archive_metadata_invalid");
                }
                JsonElement parsed = JsonParser.parseString(
                        Files.readString(metadata, StandardCharsets.UTF_8)
                );
                if (!parsed.isJsonObject()
                        || !parsed.getAsJsonObject().has("auto_load")
                        || !parsed.getAsJsonObject().get("auto_load").isJsonPrimitive()
                        || !parsed.getAsJsonObject().get("auto_load")
                        .getAsJsonPrimitive().isBoolean()) {
                    return errorResponse(409, "world_archive_metadata_invalid");
                }
                autoLoad = parsed.getAsJsonObject().get("auto_load").getAsBoolean();
            }

            Files.move(source, destination);
            MultiverseWorld world = manager.getWorld(name)
                    .getOrElse((MultiverseWorld) null);
            if (world == null) {
                Files.move(destination, source);
                return errorResponse(503, "world_restore_config_failed");
            }
            boolean previousAutoLoad = world.isAutoLoad();
            if (world.setAutoLoad(autoLoad).isFailure()) {
                Files.move(destination, source);
                return errorResponse(503, "world_restore_config_failed");
            }
            if (manager.saveWorldsConfig().isFailure()) {
                world.setAutoLoad(previousAutoLoad);
                manager.saveWorldsConfig();
                Files.move(destination, source);
                return errorResponse(503, "world_restore_config_failed");
            }
            try {
                Files.deleteIfExists(metadata);
            } catch (IOException exception) {
                plugin.getLogger().warning(
                        "World restored but archive metadata cleanup failed."
                );
            }
            JsonObject body = new JsonObject();
            body.addProperty("world", name);
            body.addProperty("loaded", false);
            body.addProperty("archived", false);
            body.addProperty("action", "restored");
            return new BridgeResponse(200, GSON.toJson(body));
        }).get(60, TimeUnit.SECONDS);
    }

    private BridgeResponse importWorld(JsonObject payload)
            throws InterruptedException, ExecutionException, TimeoutException {
        if (payload.size() != 3
                || !payload.has("name")
                || !payload.has("confirmed_name")
                || !payload.has("environment")) {
            return errorResponse(400, "invalid_world_import_payload");
        }
        String name = stringValue(payload, "name");
        String confirmed = stringValue(payload, "confirmed_name");
        String environmentValue = stringValue(payload, "environment");
        if (!validWorldName(name) || !name.equals(confirmed)
                || environmentValue == null) {
            return errorResponse(400, "invalid_world_import_payload");
        }

        World.Environment environment;
        try {
            environment = World.Environment.valueOf(environmentValue);
        } catch (IllegalArgumentException exception) {
            return errorResponse(400, "unsupported_world_environment");
        }
        if (environment == World.Environment.CUSTOM) {
            return errorResponse(400, "unsupported_world_environment");
        }

        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!MultiverseCoreApi.isLoaded()) {
                return errorResponse(503, "multiverse_unavailable");
            }
            var manager = MultiverseCoreApi.get().getWorldManager();
            if (manager.isWorld(name)) {
                return errorResponse(409, "world_name_already_registered");
            }

            Path root = plugin.getServer().getWorldContainer().toPath().toRealPath();
            if (!isSafeWorldDirectory(root, name)) {
                return errorResponse(400, "world_folder_not_valid");
            }

            var result = manager.importWorld(
                    ImportWorldOptions.worldName(name)
                            .environment(environment)
                            .doFolderCheck(true)
            );
            if (result.isFailure()) {
                return errorResponse(409, "world_import_rejected");
            }
            return worldActionResponse(name, true, "imported");
        }).get(60, TimeUnit.SECONDS);
    }

    private boolean isArchivedWorld(String name) {
        try {
            Path root = plugin.getServer().getWorldContainer().toPath().toRealPath();
            Path trash = root.resolve(".management-world-trash");
            if (Files.isSymbolicLink(trash)
                    || !Files.isDirectory(trash, LinkOption.NOFOLLOW_LINKS)) {
                return false;
            }
            Path candidate = trash.resolve(name).normalize();
            return candidate.getParent().equals(trash)
                    && !Files.isSymbolicLink(candidate)
                    && Files.isDirectory(candidate, LinkOption.NOFOLLOW_LINKS);
        } catch (IOException exception) {
            return false;
        }
    }

    static String confirmedWorldName(JsonObject payload) {
        if (payload.size() != 2
                || !payload.has("name")
                || !payload.has("confirmed_name")) {
            return null;
        }
        String name = stringValue(payload, "name");
        String confirmed = stringValue(payload, "confirmed_name");
        return validWorldName(name) && name.equals(confirmed) ? name : null;
    }

    private static String stringValue(JsonObject payload, String key) {
        JsonElement value = payload.get(key);
        if (value == null || !value.isJsonPrimitive()
                || !value.getAsJsonPrimitive().isString()) {
            return null;
        }
        return value.getAsString();
    }

    static boolean validWorldName(String name) {
        return name != null && WORLD_NAME.matcher(name).matches()
                && !".".equals(name) && !"..".equals(name);
    }

    static boolean isSafeWorldDirectory(Path root, String name) {
        if (!validWorldName(name)) {
            return false;
        }
        Path normalizedRoot = root.toAbsolutePath().normalize();
        Path folder = normalizedRoot.resolve(name).normalize();
        return normalizedRoot.equals(folder.getParent())
                && !Files.isSymbolicLink(folder)
                && Files.isDirectory(folder, LinkOption.NOFOLLOW_LINKS)
                && Files.isRegularFile(
                        folder.resolve("level.dat"), LinkOption.NOFOLLOW_LINKS
                );
    }

    private static BridgeResponse worldActionResponse(
            String name, boolean loaded, String action
    ) {
        JsonObject body = new JsonObject();
        body.addProperty("world", name);
        body.addProperty("loaded", loaded);
        body.addProperty("action", action);
        return new BridgeResponse(200, GSON.toJson(body));
    }

    private String getMultiverseWorldsJson()
            throws InterruptedException, ExecutionException, TimeoutException {
        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            if (!org.mvplugins.multiverse.core.MultiverseCoreApi.isLoaded()) {
                throw new IllegalStateException("Multiverse-Core is not loaded.");
            }

            var worldManager =
                    org.mvplugins.multiverse.core.MultiverseCoreApi.get().getWorldManager();

            StringBuilder json = new StringBuilder("{\"worlds\":[");
            boolean first = true;

            for (var world : worldManager.getWorlds()) {
                if (!first) {
                    json.append(',');
                }
                first = false;

                json.append("{\"name\":\"")
                        .append(jsonEscape(world.getName()))
                        .append("\",\"alias\":\"")
                        .append(jsonEscape(world.getAliasOrName()))
                        .append("\",\"environment\":\"")
                        .append(world.getEnvironment().name())
                        .append("\",\"loaded\":")
                        .append(world.isLoaded())
                        .append(",\"archived\":")
                        .append(isArchivedWorld(world.getName()))
                        .append('}');
            }

            return json.append("]}").toString();
        }).get(3, TimeUnit.SECONDS);
    }
    private void handleWorldGamerulesRequest(HttpExchange exchange)
            throws IOException {
        String method = exchange.getRequestMethod();

        if ("GET".equals(method)) {
            String worldName;

            try {
                worldName = queryParameter(exchange, "world");
            } catch (IllegalArgumentException exception) {
                sendJson(exchange, 400, "{\"error\":\"invalid_query\"}");
                return;
            }

            if (worldName == null || worldName.isBlank()) {
                sendJson(exchange, 400, "{\"error\":\"world_required\"}");
                return;
            }

            try {
                BridgeResponse response = getWorldGamerules(worldName);
                sendJson(exchange, response.status(), response.body());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                sendJson(exchange, 503, "{\"error\":\"request_interrupted\"}");
            } catch (ExecutionException | TimeoutException exception) {
                plugin.getLogger().log(
                        java.util.logging.Level.WARNING,
                        "Per-world gamerule read failed",
                        exception
                );
                sendJson(exchange, 503, "{\"error\":\"gamerule_read_unavailable\"}");
            }
            return;
        }

        if (!"PUT".equals(method)) {
            sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }

        JsonObject payload;
        try {
            payload = readJsonObject(exchange);
        } catch (JsonParseException | IllegalArgumentException exception) {
            sendJson(exchange, 400, "{\"error\":\"invalid_json_request\"}");
            return;
        }

        if (payload.size() != 3
                || !payload.has("world")
                || !payload.has("key")
                || !payload.has("value")) {
            sendJson(exchange, 400, "{\"error\":\"expected_world_key_value\"}");
            return;
        }

        JsonElement worldElement = payload.get("world");
        JsonElement keyElement = payload.get("key");
        JsonElement valueElement = payload.get("value");

        if (!worldElement.isJsonPrimitive()
                || !worldElement.getAsJsonPrimitive().isString()
                || !keyElement.isJsonPrimitive()
                || !keyElement.getAsJsonPrimitive().isString()) {
            sendJson(exchange, 400, "{\"error\":\"world_and_key_must_be_strings\"}");
            return;
        }

        String worldName = worldElement.getAsString();
        String key = keyElement.getAsString();

        if (worldName.isBlank() || key.isBlank()) {
            sendJson(exchange, 400, "{\"error\":\"world_and_key_required\"}");
            return;
        }

        if (!valueElement.isJsonPrimitive()) {
            sendJson(exchange, 400, "{\"error\":\"value_must_be_boolean_or_integer\"}");
            return;
        }

        JsonPrimitive value = valueElement.getAsJsonPrimitive();

        if (!value.isBoolean() && !value.isNumber()) {
            sendJson(exchange, 400, "{\"error\":\"value_must_be_boolean_or_integer\"}");
            return;
        }

        if (value.isNumber()) {
            try {
                value.getAsBigDecimal().intValueExact();
            } catch (ArithmeticException | NumberFormatException exception) {
                sendJson(exchange, 400, "{\"error\":\"value_must_be_boolean_or_integer\"}");
                return;
            }
        }

        try {
            BridgeResponse response = updateWorldGamerule(worldName, key, value);
            sendJson(exchange, response.status(), response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            sendJson(exchange, 503, "{\"error\":\"request_interrupted\"}");
        } catch (ExecutionException | TimeoutException exception) {
            plugin.getLogger().warning(
                    "Per-world gamerule update failed: "
                            + exception.getClass().getSimpleName()
            );
            sendJson(exchange, 503, "{\"error\":\"gamerule_update_unavailable\"}");
        }
    }

    private JsonObject readJsonObject(HttpExchange exchange) throws IOException {
        byte[] body = exchange.getRequestBody().readNBytes(8193);

        if (body.length > 8192) {
            throw new IllegalArgumentException("Request body too large");
        }

        JsonElement parsed = JsonParser.parseString(
                new String(body, StandardCharsets.UTF_8)
        );

        if (!parsed.isJsonObject()) {
            throw new IllegalArgumentException("Expected a JSON object");
        }

        return parsed.getAsJsonObject();
    }

    private static String queryParameter(
            HttpExchange exchange, String expectedName
    ) {
        String query = exchange.getRequestURI().getRawQuery();

        if (query == null || query.isEmpty()) {
            return null;
        }

        String result = null;
        boolean found = false;

        for (String part : query.split("&")) {
            String[] pair = part.split("=", 2);
            String name = java.net.URLDecoder.decode(
                    pair[0], StandardCharsets.UTF_8
            );

            if (expectedName.equals(name)) {
                if (found) {
                    throw new IllegalArgumentException("Duplicate query parameter");
                }

                found = true;
                result = java.net.URLDecoder.decode(
                        pair.length == 2 ? pair[1] : "",
                        StandardCharsets.UTF_8
                );
            }
        }

        return result;
    }

    private BridgeResponse getWorldGamerules(String worldName)
            throws InterruptedException, ExecutionException, TimeoutException {
        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            World world = plugin.getServer().getWorld(worldName);

            if (world == null) {
                return errorResponse(404, "world_not_loaded");
            }

            JsonArray rules = new JsonArray();

            for (GameRule<?> rule : Registry.GAME_RULE) {
                if (!world.isEnabled(rule)) {
                    continue;
                }

                Object value = world.getGameRuleValue(rule);

                if (value != null) {
                    rules.add(gameRuleJson(rule, String.valueOf(value)));
                }
            }

            JsonObject response = new JsonObject();
            response.addProperty("world", worldName);
            response.add("gamerules", rules);

            return new BridgeResponse(200, GSON.toJson(response));
        }).get(3, TimeUnit.SECONDS);
    }

    private BridgeResponse updateWorldGamerule(
            String worldName, String key, JsonPrimitive value
    ) throws InterruptedException, ExecutionException, TimeoutException {
        return plugin.getServer().getScheduler().callSyncMethod(plugin, () -> {
            World world = plugin.getServer().getWorld(worldName);

            if (world == null) {
                return errorResponse(404, "world_not_loaded");
            }

            GameRule<?> selectedRule = null;

            for (GameRule<?> rule : Registry.GAME_RULE) {
                if (apiGameRuleKey(rule.getKey().getKey()).equals(key)) {
                    if (!world.isEnabled(rule)) {
                        return errorResponse(400, "gamerule_unavailable_in_world");
                    }
                    selectedRule = rule;
                    break;
                }
            }

            if (selectedRule == null) {
                return errorResponse(400, "unknown_gamerule");
            }

            String newValue;
            Class<?> type = selectedRule.getType();

            if (Boolean.class.equals(type)) {
                if (!value.isBoolean()) {
                    return errorResponse(400, "gamerule_requires_boolean");
                }
                newValue = Boolean.toString(value.getAsBoolean());
            } else if (Integer.class.equals(type)) {
                if (!value.isNumber()) {
                    return errorResponse(400, "gamerule_requires_integer");
                }

                try {
                    newValue = Integer.toString(
                            value.getAsBigDecimal().intValueExact()
                    );
                } catch (ArithmeticException | NumberFormatException exception) {
                    return errorResponse(400, "gamerule_requires_integer");
                }
            } else {
                return errorResponse(400, "unsupported_gamerule_type");
            }

            boolean updated;
            if (Boolean.class.equals(type)) {
                @SuppressWarnings("unchecked")
                GameRule<Boolean> booleanRule = (GameRule<Boolean>) selectedRule;
                updated = world.setGameRule(booleanRule, Boolean.valueOf(newValue));
            } else {
                @SuppressWarnings("unchecked")
                GameRule<Integer> integerRule = (GameRule<Integer>) selectedRule;
                updated = world.setGameRule(integerRule, Integer.valueOf(newValue));
            }

            if (!updated) {
                return errorResponse(400, "gamerule_update_rejected");
            }

            JsonObject response = new JsonObject();
            response.addProperty("world", worldName);
            response.add("gamerule", gameRuleJson(selectedRule, newValue));

            return new BridgeResponse(200, GSON.toJson(response));
        }).get(3, TimeUnit.SECONDS);
    }

    private static JsonObject gameRuleJson(GameRule<?> rule, String rawValue) {
        JsonObject result = new JsonObject();
        result.addProperty("key", apiGameRuleKey(rule.getKey().getKey()));

        if (Boolean.class.equals(rule.getType())) {
            result.addProperty("type", "boolean");
            result.addProperty("value", Boolean.parseBoolean(rawValue));
        } else if (Integer.class.equals(rule.getType())) {
            result.addProperty("type", "integer");
            result.addProperty("value", Integer.parseInt(rawValue));
        } else {
            result.addProperty("type", "string");
            result.addProperty("value", rawValue);
        }

        return result;
    }

    private static String apiGameRuleKey(String name) {
        StringBuilder key = new StringBuilder();

        for (int i = 0; i < name.length(); i++) {
            char character = name.charAt(i);

            if (Character.isUpperCase(character)) {
                key.append('_').append(Character.toLowerCase(character));
            } else {
                key.append(Character.toLowerCase(character));
            }
        }

        return key.toString();
    }

    private static BridgeResponse errorResponse(int status, String error) {
        JsonObject body = new JsonObject();
        body.addProperty("error", error);
        return new BridgeResponse(status, GSON.toJson(body));
    }

    private record BridgeResponse(int status, String body) {
    }
    private static String jsonEscape(String value) {
        StringBuilder result = new StringBuilder();

        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);

            switch (character) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\b' -> result.append("\\b");
                case '\f' -> result.append("\\f");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> {
                    if (character < 0x20) {
                        result.append(String.format("\\u%04x", (int) character));
                    } else {
                        result.append(character);
                    }
                }
            }
        }

        return result.toString();
    }

    private void sendJson(
            HttpExchange exchange, int status, String body
    ) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set(
                "Content-Type", "application/json; charset=utf-8"
        );
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, response.length);
        exchange.getResponseBody().write(response);
    }

    public void stop() {
        if (server != null) {
            server.stop(1);
            server = null;
        }

        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }

        expectedToken = null;
    }
}
