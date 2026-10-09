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
import org.bukkit.Registry;
import org.bukkit.World;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public final class BridgeHttpServer {

    private static final String TOKEN_FILE =
            "/opt/minecraft-management/secrets/bridge-token";
    private static final int PORT = 25586;
    private static final Gson GSON = new Gson();

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

            if (!"/health".equals(path)
                    && !"/worlds".equals(path)
                    && !"/multiverse/worlds".equals(path)
                    && !"/worlds/gamerules".equals(path)) {
                sendJson(exchange, 404, "{\"error\":\"not_found\"}");
                return;
            }

            if (!"/worlds/gamerules".equals(path)
                    && !"GET".equals(exchange.getRequestMethod())) {
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
