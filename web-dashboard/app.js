"use strict";

/*
 * The dashboard expects to share an origin with the management API,
 * or to use a same-origin reverse-proxy configuration.
 *
 * An optional override can be set before this script loads:
 * window.MINECRAFT_API_BASE = "https://your-private-dashboard-host";
 *
 * Do not put the Paper bridge token in browser-side JavaScript.
 */
const API_BASE = String(window.MINECRAFT_API_BASE || "").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 8000;

const elements = {
    apiStatus: document.getElementById("api-status"),
    apiHealth: document.getElementById("api-health"),
    bridgeHealth: document.getElementById("bridge-health"),
    sidebarStatus: document.getElementById("sidebar-status"),
    sidebarStatusDot: document.getElementById("sidebar-status-dot"),
    serverState: document.getElementById("server-state"),
    serverStateNote: document.getElementById("server-state-note"),
    serverVersion: document.getElementById("server-version"),
    serverProtocol: document.getElementById("server-protocol"),
    onlineCount: document.getElementById("online-count"),
    worldCount: document.getElementById("world-count"),
    worldsTag: document.getElementById("worlds-tag"),
    worldsList: document.getElementById("worlds-list"),
    lastUpdated: document.getElementById("last-updated"),
    refreshButton: document.getElementById("refresh-button"),
    dashboardYear: document.getElementById("dashboard-year"),
    gameruleWorld: document.getElementById("gamerule-world"),
    loadGamerulesButton: document.getElementById("load-gamerules-button"),
    gamerulesMessage: document.getElementById("gamerules-message"),
    gamerulesList: document.getElementById("gamerules-list"),
    gamerulesTag: document.getElementById("gamerules-tag"),
    playerManagementMessage: document.getElementById("player-management-message"),
    refreshPlayersButton: document.getElementById("refresh-players-button"),
    onlinePlayersList: document.getElementById("online-players-list"),
    onlinePlayersTag: document.getElementById("online-players-tag"),
    whitelistList: document.getElementById("whitelist-list"),
    whitelistTag: document.getElementById("whitelist-tag"),
    whitelistForm: document.getElementById("whitelist-form"),
    whitelistPlayerName: document.getElementById("whitelist-player-name"),
    addWhitelistPlayerButton: document.getElementById("add-whitelist-player-button"),
    operatorsList: document.getElementById("operators-list"),
    operatorsTag: document.getElementById("operators-tag"),
    operatorForm: document.getElementById("operator-form"),
    operatorPlayerName: document.getElementById("operator-player-name"),
    operatorPermissionLevel: document.getElementById("operator-permission-level"),
    operatorBypassPlayerLimit: document.getElementById("operator-bypass-player-limit"),
    grantOperatorButton: document.getElementById("grant-operator-button"),
    moderationBanReason: document.getElementById("moderation-ban-reason"),
    moderationBanDuration: document.getElementById("moderation-ban-duration"),
    bannedPlayersList: document.getElementById("banned-players-list"),
    bannedPlayersTag: document.getElementById("banned-players-tag")
};

function setText(element, value) {
    if (element) {
        element.textContent = String(value);
    }
}

async function apiGet(path) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Request failed with HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Request timed out");
        }
        if (error instanceof TypeError) {
            throw new Error("Could not reach the API from this page");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function apiPut(path, payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method: "PUT",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify(payload)
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            // The API should return JSON, but handle an empty response safely.
        }

        if (!response.ok) {
            const detail = typeof data?.detail === "string"
                ? data.detail
                : `HTTP ${response.status}`;
            throw new Error(detail);
        }

        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Request timed out");
        }
        if (error instanceof TypeError) {
            throw new Error("Could not reach the API from this page");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function apiWrite(path, method, payload) {
    if (!["POST", "DELETE"].includes(method)) {
        throw new Error("Unsupported write method");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify(payload)
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            // Handle an empty or non-JSON response safely.
        }

        if (!response.ok) {
            const detail = typeof data?.detail === "string"
                ? data.detail
                : `HTTP ${response.status}`;
            throw new Error(detail);
        }

        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Request timed out");
        }
        if (error instanceof TypeError) {
            throw new Error("Could not reach the API from this page");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

function apiPost(path, payload) {
    return apiWrite(path, "POST", payload);
}

function apiDelete(path, payload) {
    return apiWrite(path, "DELETE", payload);
}
function setGamerulesMessage(message, isError = false) {
    if (!elements.gamerulesMessage) return;
    elements.gamerulesMessage.textContent = message;
    elements.gamerulesMessage.classList.toggle("error", isError);
}

function updateGameruleWorldOptions(worldsData) {
    const select = elements.gameruleWorld;
    if (!select) return;

    const worlds = Array.isArray(worldsData?.worlds)
        ? worldsData.worlds.filter(
            world => world && typeof world.name === "string"
        )
        : [];
    const previous = select.value;

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = worlds.length
        ? "Choose a world..."
        : "No worlds available";
    select.append(placeholder);

    for (const world of worlds) {
        const option = document.createElement("option");
        option.value = world.name;
        option.textContent = world.name;
        select.append(option);
    }

    select.value = worlds.some(world => world.name === previous)
        ? previous
        : "";
}

function renderGamerules(worldName, gamerules) {
    const list = elements.gamerulesList;
    if (!list) return;

    list.replaceChildren();
    setText(elements.gamerulesTag, `${gamerules.length} rules`);

    if (gamerules.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No gamerules were returned for this world.";
        list.append(empty);
        return;
    }

    for (const rule of gamerules) {
        const row = document.createElement("div");
        row.className = "gamerule-row";

        const details = document.createElement("div");
        details.className = "gamerule-details";

        const key = document.createElement("strong");
        key.textContent = String(rule.key);

        const type = document.createElement("small");
        type.textContent = rule.type === "boolean"
            ? "Boolean"
            : rule.type === "integer" ? "Integer" : String(rule.type);

        details.append(key, type);

        const controlArea = document.createElement("div");
        controlArea.className = "gamerule-control";

        let control = null;
        if (rule.type === "boolean" && typeof rule.value === "boolean") {
            control = document.createElement("input");
            control.type = "checkbox";
            control.checked = rule.value;
            control.setAttribute("aria-label", `${rule.key} value`);
            control.className = "gamerule-checkbox";
            controlArea.append(control);
        } else if (rule.type === "integer" && Number.isInteger(rule.value)) {
            control = document.createElement("input");
            control.type = "number";
            control.step = "1";
            control.value = String(rule.value);
            control.setAttribute("aria-label", `${rule.key} value`);
            control.className = "gamerule-number";
            controlArea.append(control);
        } else {
            const value = document.createElement("span");
            value.className = "gamerule-readonly";
            value.textContent = String(rule.value);
            controlArea.append(value);
        }

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "button button-secondary gamerule-save";
        saveButton.textContent = "Save";
        saveButton.disabled = control === null;

        if (control !== null) {
            saveButton.addEventListener("click", async () => {
                let value;

                if (rule.type === "boolean") {
                    value = control.checked;
                } else {
                    const raw = control.value.trim();
                    value = Number(raw);

                    if (raw === "" || !Number.isSafeInteger(value)) {
                        setGamerulesMessage(
                            `Enter a valid integer for ${rule.key}.`,
                            true
                        );
                        control.focus();
                        return;
                    }
                }

                saveButton.disabled = true;
                setGamerulesMessage(`Saving ${worldName}.${rule.key}...`);

                try {
                    await apiPut("/worlds/gamerules", {
                        world: worldName,
                        key: rule.key,
                        value
                    });

                    await loadWorldGamerules(
                        `${worldName}.${rule.key} saved; the value was read back from the API.`
                    );
                } catch (error) {
                    setGamerulesMessage(
                        `Could not save ${rule.key}: ${error.message}`,
                        true
                    );
                } finally {
                    // A successful refresh replaces this row and its button.
                    if (saveButton.isConnected) {
                        saveButton.disabled = false;
                    }
                }
            });
        }

        row.append(details, controlArea, saveButton);
        list.append(row);
    }
}

async function loadWorldGamerules(successMessage = "") {
    const worldName = elements.gameruleWorld?.value || "";

    if (!worldName) {
        setGamerulesMessage("Choose a world before loading gamerules.", true);
        return;
    }

    if (elements.loadGamerulesButton) {
        elements.loadGamerulesButton.disabled = true;
    }

    setText(elements.gamerulesTag, "Loading");
    setGamerulesMessage(`Loading gamerules for ${worldName}...`);

    if (elements.gamerulesList) {
        elements.gamerulesList.replaceChildren();
        const loading = document.createElement("div");
        loading.className = "loading-state";
        loading.textContent = "Loading gamerules...";
        elements.gamerulesList.append(loading);
    }

    try {
        const query = new URLSearchParams({ world: worldName });
        const data = await apiGet(`/worlds/gamerules?${query.toString()}`);

        if (
            data?.world !== worldName
            || !Array.isArray(data.gamerules)
            || !data.gamerules.every(
                rule => rule && typeof rule.key === "string"
                    && ["boolean", "integer", "string"].includes(rule.type)
                    && Object.hasOwn(rule, "value")
            )
        ) {
            throw new Error("Unexpected gamerule response");
        }

        renderGamerules(worldName, data.gamerules);
        setGamerulesMessage(
            successMessage || `Loaded ${data.gamerules.length} gamerules for ${worldName}.`
        );
    } catch (error) {
        setText(elements.gamerulesTag, "Unavailable");
        setGamerulesMessage(
            `Could not load gamerules: ${error.message}`,
            true
        );

        if (elements.gamerulesList) {
            elements.gamerulesList.replaceChildren();
            const message = document.createElement("div");
            message.className = "error-state";
            message.textContent = error.message;
            elements.gamerulesList.append(message);
        }
    } finally {
        if (elements.loadGamerulesButton) {
            elements.loadGamerulesButton.disabled = false;
        }
    }
}
function setHealth(element, healthy, label) {
    if (!element) return;

    element.textContent = label;
    element.classList.remove("ok", "bad", "checking");
    element.classList.add(healthy ? "ok" : "bad");
}

function setConnectionBadge(healthy, label) {
    const badge = elements.apiStatus;
    if (!badge) return;

    badge.classList.remove("connected", "failed");
    badge.classList.add(healthy ? "connected" : "failed");

    const dot = badge.querySelector(".status-dot");
    if (dot) {
        dot.classList.toggle("online", healthy);
        dot.classList.toggle("offline", !healthy);
    }

    // Keep the status text safe; response content is never injected as HTML.
    badge.replaceChildren();
    const statusDot = document.createElement("span");
    statusDot.className = `status-dot ${healthy ? "online" : "offline"}`;
    badge.append(statusDot, document.createTextNode(` ${label}`));
}

function setServerState(started) {
    const label = started ? "Online" : "Offline";

    setText(elements.serverState, label);
    setText(
        elements.serverStateNote,
        started ? "Minecraft server is running" : "Minecraft server is stopped"
    );

    if (elements.serverState) {
        elements.serverState.classList.remove("state-online", "state-offline");
        elements.serverState.classList.add(
            started ? "state-online" : "state-offline"
        );
    }

    setText(elements.sidebarStatus, started ? "Server online" : "Server offline");

    if (elements.sidebarStatusDot) {
        elements.sidebarStatusDot.classList.toggle("online", started);
        elements.sidebarStatusDot.classList.toggle("offline", !started);
    }
}

function setUnavailable(element, message) {
    setText(element, "--");
    if (element && element.classList) {
        element.classList.remove("state-online", "state-offline");
    }
    if (message && element) {
        element.setAttribute("title", message);
    }
}

function createWorldRow(world, multiverseInfo) {
    const row = document.createElement("div");
    row.className = "world-row";

    const environment = String(
        multiverseInfo?.environment || world.environment || "Unknown"
    ).toUpperCase();

    const icon = document.createElement("span");
    icon.className = "world-icon";

    if (environment.includes("NETHER")) {
        icon.classList.add("world-nether");
        icon.textContent = "N";
    } else if (environment.includes("END")) {
        icon.classList.add("world-end");
        icon.textContent = "E";
    } else {
        icon.textContent = "W";
    }
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "world-copy";

    const name = document.createElement("strong");
    name.textContent = String(world.name || "Unnamed world");

    const detail = document.createElement("small");
    const alias = multiverseInfo?.alias;
    detail.textContent = alias && alias !== world.name
        ? `${environment} · ${alias}`
        : environment;

    copy.append(name, detail);

    const state = document.createElement("span");
    const loaded = typeof multiverseInfo?.loaded === "boolean"
        ? multiverseInfo.loaded
        : null;

    state.className = `world-state${loaded === null ? " unknown" : ""}`;

    const dot = document.createElement("span");
    dot.className = `status-dot${loaded === true ? " online" : ""}`;
    dot.setAttribute("aria-hidden", "true");

    const stateLabel = document.createElement("span");
    stateLabel.textContent = loaded === null
        ? "Listed"
        : loaded ? "Loaded" : "Unloaded";

    state.append(dot, stateLabel);
    row.append(icon, copy, state);

    return row;
}

function renderWorlds(worldsData, multiverseData) {
    const worlds = Array.isArray(worldsData?.worlds)
        ? worldsData.worlds.filter(
            world => world && typeof world.name === "string"
        )
        : [];

    const multiverseWorlds = Array.isArray(multiverseData?.worlds)
        ? multiverseData.worlds
        : [];

    const multiverseByName = new Map(
        multiverseWorlds
            .filter(world => world && typeof world.name === "string")
            .map(world => [world.name, world])
    );

    setText(elements.worldCount, worlds.length);
    setText(elements.worldsTag, `${worlds.length} worlds`);
    updateGameruleWorldOptions(worldsData);

    if (!elements.worldsList) return;
    elements.worldsList.replaceChildren();

    if (worlds.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No worlds were returned by the API.";
        elements.worldsList.append(empty);
        return;
    }

    for (const world of worlds) {
        elements.worldsList.append(
            createWorldRow(world, multiverseByName.get(world.name))
        );
    }
}

function getPlayerDisplayName(player) {
    const candidates = [
        typeof player === "string" ? player : "",
        player?.name,
        player?.player?.name,
        player?.profile?.name,
        player?.username
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
}

function getPlayerIdentity(player) {
    const name = getPlayerDisplayName(player);
    const candidates = [
        player?.id,
        player?.player?.id,
        player?.profile?.id
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            if (name) {
                return { name, id: candidate.trim() };
            }
        }
    }

    return null;
}
function renderPlayerList(
    container,
    tag,
    players,
    emptyMessage,
    allowWhitelistRemoval = false,
    allowOperatorRemoval = false,
    allowModerationActions = false,
    allowBanRemoval = false
) {
    if (!container) return;

    container.replaceChildren();

    const entries = players
        .map((player) => ({
            player,
            name: getPlayerDisplayName(player)
        }))
        .filter((entry) => entry.name);

    setText(tag, `${entries.length} players`);

    if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = emptyMessage;
        container.append(empty);
        return;
    }

    for (const entry of entries) {
        const { player, name } = entry;
        const row = document.createElement("div");
        row.className = "player-row";

        const label = document.createElement("span");
        label.className = "player-name";
        label.textContent = name;
        row.append(label);

        if (allowBanRemoval) {
            const identity = getPlayerIdentity(player);

            if (identity) {
                const unbanButton = document.createElement("button");
                unbanButton.type = "button";
                unbanButton.className = "button button-secondary moderation-action-button";
                unbanButton.textContent = "Unban";
                unbanButton.setAttribute("aria-label", `Unban ${name}`);
                unbanButton.addEventListener("click", () => {
                    removeBan(identity, unbanButton);
                });
                row.append(unbanButton);
            } else {
                const unavailable = document.createElement("span");
                unavailable.className = "moderation-unavailable";
                unavailable.textContent = "ID unavailable";
                unavailable.title = "Unban requires a player ID from the server.";
                row.append(unavailable);
            }
        }

        if (allowModerationActions) {
            const identity = getPlayerIdentity(player);

            if (identity) {
                const kickButton = document.createElement("button");
                kickButton.type = "button";
                kickButton.className = "button button-secondary moderation-action-button";
                kickButton.textContent = "Kick";
                kickButton.setAttribute("aria-label", `Kick ${name}`);
                kickButton.addEventListener("click", () => {
                    kickPlayer(identity, kickButton);
                });
                row.append(kickButton);

                const banButton = document.createElement("button");
                banButton.type = "button";
                banButton.className = "button button-secondary moderation-action-button";
                banButton.textContent = "Ban";
                banButton.setAttribute("aria-label", `Ban ${name}`);
                banButton.addEventListener("click", () => {
                    banPlayer(identity, banButton);
                });
                row.append(banButton);
            } else {
                const unavailable = document.createElement("span");
                unavailable.className = "moderation-unavailable";
                unavailable.textContent = "ID unavailable";
                unavailable.title = "Kick and Ban require a player ID from the server.";
                row.append(unavailable);
            }
        }

        if (allowWhitelistRemoval) {
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "button button-secondary whitelist-remove-button";
            removeButton.textContent = "Remove";
            removeButton.setAttribute(
                "aria-label",
                `Remove ${name} from whitelist`
            );
            removeButton.addEventListener("click", () => {
                removeWhitelistPlayer(name, removeButton);
            });
            row.append(removeButton);
        }

        if (allowOperatorRemoval) {
            const revokeButton = document.createElement("button");
            revokeButton.type = "button";
            revokeButton.className = "button button-secondary operator-revoke-button";
            revokeButton.textContent = "Revoke OP";
            revokeButton.setAttribute(
                "aria-label",
                `Revoke operator privileges for ${name}`
            );
            revokeButton.addEventListener("click", () => {
                removeOperator(name, revokeButton);
            });
            row.append(revokeButton);
        }

        container.append(row);
    }
}

function renderPlayerListError(container, tag, message) {
    if (container) {
        container.replaceChildren();

        const error = document.createElement("div");
        error.className = "error-state";
        error.textContent = `Could not load list: ${message}`;
        container.append(error);
    }

    setText(tag, "Unavailable");
}

async function loadPlayerManagement() {
    const button = elements.refreshPlayersButton;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(elements.playerManagementMessage, "Loading player lists...");

    const lists = [
        {
            path: "/player/list",
            label: "online players",
            container: elements.onlinePlayersList,
            tag: elements.onlinePlayersTag,
            empty: "No players are online.",
            moderate: true
        },
        {
            path: "/player/whitelist",
            label: "whitelist",
            container: elements.whitelistList,
            tag: elements.whitelistTag,
            empty: "The whitelist is empty.",
            removable: true
        },
        {
            path: "/player/operators",
            label: "operators",
            container: elements.operatorsList,
            tag: elements.operatorsTag,
            empty: "No operators were returned.",
            operatorRemovable: true
        },
        {
            path: "/player/bans",
            label: "banned players",
            container: elements.bannedPlayersList,
            tag: elements.bannedPlayersTag,
            empty: "No players are banned.",
            banRemovable: true
        }
    ];

    try {
        const results = await Promise.all(lists.map(async (list) => {
            try {
                const data = await apiGet(list.path);

                if (!Array.isArray(data?.players)) {
                    throw new Error("Unexpected API response");
                }

                renderPlayerList(
                    list.container,
                    list.tag,
                    data.players,
                    list.empty,
                    list.removable === true,
                    list.operatorRemovable === true,
                    list.moderate === true,
                    list.banRemovable === true
                );

                return { label: list.label, ok: true };
            } catch (error) {
                renderPlayerListError(
                    list.container,
                    list.tag,
                    error instanceof Error ? error.message : "Unknown error"
                );

                return { label: list.label, ok: false };
            }
        }));

        const failed = results.filter((result) => !result.ok);

        setText(
            elements.playerManagementMessage,
            failed.length === 0
                ? "All player lists loaded successfully."
                : `Some lists could not be loaded: ${failed.map((item) => item.label).join(", ")}.`
        );

        return failed.length === 0;
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}

async function removeWhitelistPlayer(name, button) {
    if (typeof name !== "string" || !name.trim()) return;
    if (button?.disabled) return;

    const confirmed = window.confirm(
        `Remove "${name}" from the whitelist?\n\n` +
        "This does not kick the player if they are already online."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(
        elements.playerManagementMessage,
        `Removing "${name}" from the whitelist...`
    );

    try {
        await apiDelete("/player/whitelist", {
            player: { name }
        });

        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Removed "${name}" from the whitelist.`
                : `Removed "${name}" from the whitelist, but one or more lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not remove "${name}" from the whitelist: ${detail}`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}
async function addWhitelistPlayer(event) {
    event.preventDefault();

    const input = elements.whitelistPlayerName;
    const button = elements.addWhitelistPlayerButton;

    if (!input || !button || button.disabled) return;

    const name = input.value.trim();

    if (!name) {
        setText(elements.playerManagementMessage, "Enter a player name.");
        input.focus();
        return;
    }

    if (name.length > 64 || /[\x00-\x1F\x7F]/.test(name)) {
        setText(
            elements.playerManagementMessage,
            "The player name is invalid. Use at most 64 characters without control characters."
        );
        input.focus();
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Adding...";
    setText(elements.playerManagementMessage, `Adding "${name}" to the whitelist...`);

    try {
        await apiPost("/player/whitelist", {
            player: { name }
        });

        input.value = "";
        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Added "${name}" to the whitelist.`
                : `Added "${name}" to the whitelist, but one or more lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not add "${name}" to the whitelist: ${detail}`
        );
    } finally {
        button.disabled = false;
        button.textContent = originalLabel || "Add player";
    }
}
async function banPlayer(identity, button) {
    if (
        !identity ||
        typeof identity.name !== "string" ||
        !identity.name.trim() ||
        typeof identity.id !== "string" ||
        !identity.id.trim()
    ) {
        setText(
            elements.playerManagementMessage,
            "Cannot ban this player because their identity is incomplete."
        );
        return;
    }

    if (button?.disabled) return;

    const reasonInput = elements.moderationBanReason;
    const durationSelect = elements.moderationBanDuration;

    if (!reasonInput || !durationSelect) {
        setText(
            elements.playerManagementMessage,
            "Ban controls are unavailable. Refresh the dashboard and try again."
        );
        return;
    }

    const reason = reasonInput.value.trim();

    if (!reason) {
        setText(
            elements.playerManagementMessage,
            "Enter a reason before banning a player."
        );
        reasonInput.focus();
        return;
    }

    if (reason.length > 160 || /[\x00-\x1F\x7F]/.test(reason)) {
        setText(
            elements.playerManagementMessage,
            "The ban reason must be at most 160 characters and contain no control characters."
        );
        reasonInput.focus();
        return;
    }

    const duration = durationSelect.value;
    const durations = {
        "1h": { label: "1 hour", milliseconds: 60 * 60 * 1000 },
        "24h": { label: "24 hours", milliseconds: 24 * 60 * 60 * 1000 },
        "7d": { label: "7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
        "permanent": { label: "Permanent", milliseconds: null }
    };

    const durationInfo = durations[duration];

    if (!durationInfo) {
        setText(
            elements.playerManagementMessage,
            "Choose a valid ban duration."
        );
        durationSelect.focus();
        return;
    }

    const expires = durationInfo.milliseconds === null
        ? null
        : new Date(Date.now() + durationInfo.milliseconds).toISOString();

    const confirmed = window.confirm(
        `Ban "${identity.name}"?\n\n` +
        `Duration: ${durationInfo.label}\n` +
        `Reason: ${reason}\n\n` +
        "The player will be prevented from joining while the ban is active."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(
        elements.playerManagementMessage,
        `Banning "${identity.name}"...`
    );

    try {
        await apiPost("/player/bans", {
            player: {
                name: identity.name,
                id: identity.id
            },
            reason,
            source: "Management API",
            expires
        });

        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Banned "${identity.name}" (${durationInfo.label}).`
                : `Banned "${identity.name}", but one or more player lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not ban "${identity.name}": ${detail}`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}
async function kickPlayer(identity, button) {
    if (
        !identity ||
        typeof identity.name !== "string" ||
        !identity.name.trim() ||
        typeof identity.id !== "string" ||
        !identity.id.trim()
    ) {
        setText(
            elements.playerManagementMessage,
            "Cannot kick this player because their identity is incomplete."
        );
        return;
    }

    if (button?.disabled) return;

    const confirmed = window.confirm(
        `Kick "${identity.name}" from the server?\n\n` +
        "This disconnects the player but does not ban them."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(
        elements.playerManagementMessage,
        `Kicking "${identity.name}"...`
    );

    try {
        await apiPost("/player/kick", {
            player: {
                name: identity.name,
                id: identity.id
            },
            message: "Kicked by server administrator"
        });

        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Kicked "${identity.name}" from the server.`
                : `Kicked "${identity.name}", but one or more player lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not kick "${identity.name}": ${detail}`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}
async function removeBan(identity, button) {
    if (
        !identity ||
        typeof identity.name !== "string" ||
        !identity.name.trim() ||
        typeof identity.id !== "string" ||
        !identity.id.trim()
    ) {
        setText(
            elements.playerManagementMessage,
            "Cannot unban this entry because its player identity is incomplete."
        );
        return;
    }

    if (button?.disabled) return;

    const confirmed = window.confirm(
        `Unban "${identity.name}"?\n\n` +
        "This removes the player's ban. It does not add them to the whitelist."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(
        elements.playerManagementMessage,
        `Removing the ban for "${identity.name}"...`
    );

    try {
        await apiDelete("/player/bans", {
            player: {
                name: identity.name,
                id: identity.id
            }
        });

        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Removed the ban for "${identity.name}".`
                : `Removed the ban for "${identity.name}", but one or more player lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not unban "${identity.name}": ${detail}`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}
async function removeOperator(name, button) {
    if (typeof name !== "string" || !name.trim()) return;
    if (button?.disabled) return;

    const confirmed = window.confirm(
        `Revoke operator privileges from "${name}"?\n\n` +
        "The player will lose OP permissions. This does not kick them from the server."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    setText(
        elements.playerManagementMessage,
        `Revoking OP from "${name}"...`
    );

    try {
        await apiDelete("/player/operators", {
            player: { name }
        });

        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Revoked OP from "${name}".`
                : `Revoked OP from "${name}", but one or more player lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not revoke OP from "${name}": ${detail}`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}
async function grantOperator(event) {
    event.preventDefault();

    const input = elements.operatorPlayerName;
    const levelSelect = elements.operatorPermissionLevel;
    const bypassCheckbox = elements.operatorBypassPlayerLimit;
    const button = elements.grantOperatorButton;

    if (!input || !levelSelect || !bypassCheckbox || !button || button.disabled) {
        return;
    }

    const name = input.value.trim();

    if (!name) {
        setText(elements.playerManagementMessage, "Enter a player name.");
        input.focus();
        return;
    }

    if (name.length > 64 || /[\x00-\x1F\x7F]/.test(name)) {
        setText(
            elements.playerManagementMessage,
            "The player name is invalid. Use at most 64 characters without control characters."
        );
        input.focus();
        return;
    }

    const permissionLevel = Number(levelSelect.value);

    if (!Number.isInteger(permissionLevel) || permissionLevel < 1 || permissionLevel > 4) {
        setText(elements.playerManagementMessage, "Choose an operator permission level from 1 to 4.");
        levelSelect.focus();
        return;
    }

    const bypassesPlayerLimit = bypassCheckbox.checked;

    const confirmed = window.confirm(
        `Grant OP to "${name}"?\n\n` +
        `Permission level: ${permissionLevel}\n` +
        `Can bypass player limit: ${bypassesPlayerLimit ? "Yes" : "No"}\n\n` +
        "Only grant operator access to trusted players."
    );

    if (!confirmed) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Granting...";
    setText(elements.playerManagementMessage, `Granting OP to "${name}"...`);

    try {
        await apiPost("/player/operators", {
            operator: {
                player: { name },
                permissionLevel,
                bypassesPlayerLimit
            }
        });

        input.value = "";
        const refreshed = await loadPlayerManagement();

        setText(
            elements.playerManagementMessage,
            refreshed
                ? `Granted OP to "${name}" at permission level ${permissionLevel}.`
                : `Granted OP to "${name}", but one or more player lists could not refresh. Use Refresh players to retry.`
        );
    } catch (error) {
        const detail = error instanceof Error
            ? error.message
            : "Unknown error";

        setText(
            elements.playerManagementMessage,
            `Could not grant OP to "${name}": ${detail}`
        );
    } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = originalLabel || "Grant OP";
    }
}
async function refreshDashboard() {
    if (elements.refreshButton) {
        elements.refreshButton.disabled = true;
        elements.refreshButton.setAttribute("aria-busy", "true");
    }

    let apiReachable = false;

    // Each panel updates independently, so one unavailable endpoint does not
    // prevent the rest of the dashboard from showing useful data.
    const tasks = [
        {
            path: "/health",
            run(data) {
                const healthy = data && data.status === "healthy";
                setHealth(
                    elements.apiHealth,
                    healthy,
                    healthy ? "Healthy" : "Unavailable"
                );
                apiReachable = healthy;
            },
            fail() {
                setHealth(elements.apiHealth, false, "Unavailable");
            }
        },
        {
            path: "/server/status",
            run(data) {
                if (typeof data?.started !== "boolean") {
                    throw new Error("Unexpected server status response");
                }

                setServerState(data.started);
                setText(
                    elements.serverVersion,
                    data.version?.name || "Unknown"
                );
                setText(
                    elements.serverProtocol,
                    Number.isInteger(data.version?.protocol)
                        ? `Protocol ${data.version.protocol}`
                        : "Protocol unavailable"
                );
            },
            fail(error) {
                setUnavailable(elements.serverState, error.message);
                setText(elements.serverStateNote, "Status unavailable");
                setUnavailable(elements.serverVersion);
                setText(elements.serverProtocol, "Version unavailable");
                setText(elements.sidebarStatus, "Status unavailable");

                if (elements.sidebarStatusDot) {
                    elements.sidebarStatusDot.classList.remove("online");
                    elements.sidebarStatusDot.classList.add("offline");
                }
            }
        },
        {
            path: "/player/list",
            run(data) {
                if (!Array.isArray(data?.players)) {
                    throw new Error("Unexpected player-list response");
                }
                setText(elements.onlineCount, data.players.length);
            },
            fail(error) {
                setUnavailable(elements.onlineCount, error.message);
            }
        },
        {
            path: "/worlds",
            run(data) {
                if (!Array.isArray(data?.worlds)) {
                    throw new Error("Unexpected world-list response");
                }
                renderWorlds(data, window.__dashboardMultiverseData || null);
                window.__dashboardWorldData = data;
            },
            fail(error) {
                setUnavailable(elements.worldCount, error.message);
                setText(elements.worldsTag, "Unavailable");

                if (elements.worldsList) {
                    elements.worldsList.replaceChildren();
                    const message = document.createElement("div");
                    message.className = "error-state";
                    message.textContent = `Could not load worlds: ${error.message}`;
                    elements.worldsList.append(message);
                }
            }
        },
        {
            path: "/worlds/multiverse",
            run(data) {
                if (!Array.isArray(data?.worlds)) {
                    throw new Error("Unexpected Multiverse response");
                }
                window.__dashboardMultiverseData = data;
                if (window.__dashboardWorldData) {
                    renderWorlds(
                        window.__dashboardWorldData,
                        window.__dashboardMultiverseData
                    );
                }
            },
            fail() {
                // The base world list is still useful without Multiverse data.
                window.__dashboardMultiverseData = null;
                if (window.__dashboardWorldData) {
                    renderWorlds(window.__dashboardWorldData, null);
                }
            }
        },
        {
            path: "/bridge/health",
            run(data) {
                const healthy = Boolean(data && data.status && data.bridge);
                setHealth(
                    elements.bridgeHealth,
                    healthy,
                    healthy ? "Connected" : "Unavailable"
                );
            },
            fail() {
                setHealth(elements.bridgeHealth, false, "Unavailable");
            }
        }
    ];

    try {
        await Promise.all(tasks.map(async task => {
            try {
                const data = await apiGet(task.path);
                task.run(data);
            } catch (error) {
                task.fail(error);
            }
        }));

        setConnectionBadge(apiReachable, apiReachable ? "API connected" : "API unavailable");
        setText(
            elements.lastUpdated,
            `Updated ${new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            })}`
        );
    } finally {
        if (elements.refreshButton) {
            elements.refreshButton.disabled = false;
            elements.refreshButton.removeAttribute("aria-busy");
        }
    }
}

if (elements.refreshButton) {
    elements.refreshButton.addEventListener("click", refreshDashboard);
}

if (elements.operatorForm) {
    elements.operatorForm.addEventListener("submit", grantOperator);
}
if (elements.whitelistForm) {
    elements.whitelistForm.addEventListener("submit", addWhitelistPlayer);
}
if (elements.refreshPlayersButton) {
    elements.refreshPlayersButton.addEventListener("click", loadPlayerManagement);
}

if (elements.loadGamerulesButton) {
    elements.loadGamerulesButton.addEventListener("click", () => loadWorldGamerules());
}

if (elements.gameruleWorld) {
    elements.gameruleWorld.addEventListener("change", () => {
        if (elements.gameruleWorld.value) {
            loadWorldGamerules();
        } else {
            setText(elements.gamerulesTag, "Not loaded");
            setGamerulesMessage("Choose a world to inspect its gamerules.");
            elements.gamerulesList?.replaceChildren();
        }
    });
}

if (elements.dashboardYear) {
    setText(elements.dashboardYear, new Date().getFullYear());
}

refreshDashboard();
loadPlayerManagement();