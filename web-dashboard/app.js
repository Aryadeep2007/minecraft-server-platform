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
    operatorsList: document.getElementById("operators-list"),
    operatorsTag: document.getElementById("operators-tag")
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

function renderPlayerList(container, tag, players, emptyMessage) {
    if (!container) return;

    container.replaceChildren();

    const names = players.map(getPlayerDisplayName).filter(Boolean);
    setText(tag, `${names.length} players`);

    if (names.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = emptyMessage;
        container.append(empty);
        return;
    }

    for (const name of names) {
        const row = document.createElement("div");
        row.className = "player-row";

        const label = document.createElement("span");
        label.className = "player-name";
        label.textContent = name;

        row.append(label);
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
            empty: "No players are online."
        },
        {
            path: "/player/whitelist",
            label: "whitelist",
            container: elements.whitelistList,
            tag: elements.whitelistTag,
            empty: "The whitelist is empty."
        },
        {
            path: "/player/operators",
            label: "operators",
            container: elements.operatorsList,
            tag: elements.operatorsTag,
            empty: "No operators were returned."
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
                    list.empty
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
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
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