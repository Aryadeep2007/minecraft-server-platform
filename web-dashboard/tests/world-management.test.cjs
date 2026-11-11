"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

class TestFile {
    constructor(name, size) {
        this.name = name;
        this.size = size;
    }
}

function createHarness({ promptResult = "TestWorld", responseStatus = 200 } = {}) {
    const fetchCalls = [];
    const promptMessages = [];
    const submitButton = makeButton();
    const createMessage = makeMessage();
    const importMessage = makeMessage();
    const worldSummary = makeMessage();
    const worldsList = makeList();
    const worldCount = makeMessage();
    const worldsTag = makeMessage();
    const worldSearch = { value: "", addEventListener() {} };
    const worldStateFilter = { value: "all", addEventListener() {} };

    const createForm = makeForm({
        name: "TestWorld",
        environment: "NORMAL",
        world_type: "NORMAL",
        game_mode: "SURVIVAL",
        difficulty: "NORMAL",
        generate_structures: "on"
    }, submitButton);
    const importForm = makeForm({
        name: "TestWorld",
        archive: new TestFile("world.zip", 1024),
        environment: "THE_END"
    }, submitButton);
    const registerForm = makeForm({
        name: "TestWorld",
        environment: "NETHER"
    }, submitButton);

    const elements = {
        "world-summary": worldSummary,
        "world-create-form": createForm,
        "world-create-message": createMessage,
        "world-import-form": importForm,
        "world-import-message": importMessage,
        "world-register-form": registerForm,
        "worlds-list": worldsList,
        "world-count": worldCount,
        "worlds-tag": worldsTag,
        "world-search": worldSearch,
        "world-state-filter": worldStateFilter
    };

    const document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement(tagName) {
            return {
                tagName,
                children: [],
                attributes: {},
                listeners: {},
                disabled: false,
                classList: makeClassList(),
                append(...children) {
                    this.children.push(...children);
                },
                replaceChildren(...children) {
                    this.children = [...children];
                },
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                removeAttribute(name) {
                    delete this.attributes[name];
                },
                addEventListener(name, handler) {
                    this.listeners[name] = handler;
                }
            };
        },
        createTextNode(text) {
            return { textContent: String(text) };
        }
    };

    const window = {
        MINECRAFT_API_BASE: "",
        setTimeout,
        clearTimeout,
        prompt(message) {
            promptMessages.push(String(message));
            return promptResult;
        }
    };

    async function mockFetch(url, options = {}) {
        fetchCalls.push({
            url: String(url),
            method: (options.method || "GET").toUpperCase(),
            headers: options.headers || {},
            body: options.body || null
        });
        return {
            ok: responseStatus >= 200 && responseStatus < 300,
            status: responseStatus,
            async json() {
                const payload = typeof options.body === "string"
                    ? JSON.parse(options.body)
                    : null;
                return responseStatus >= 400
                    ? { detail: "request rejected" }
                    : { world: payload?.name || "TestWorld" };
            }
        };
    }

    const context = vm.createContext({
        window,
        document,
        fetch: mockFetch,
        FormData: class {
            constructor(form) {
                this.values = form.values;
            }
            get(name) {
                return this.values[name] ?? null;
            }
        },
        File: TestFile,
        AbortController,
        console,
        setTimeout,
        clearTimeout
    });

    const startupCalls = /\nrefreshDashboard\(\);\r?\nloadPlayerManagement\(\);\s*$/;
    assert.match(appSource, startupCalls);
    vm.runInContext(appSource.replace(startupCalls, "\n"), context, {
        filename: "app.js"
    });
    context.refreshWorldOverview = async () => {};

    return {
        context,
        elements,
        fetchCalls,
        promptMessages,
        createForm,
        importForm,
        registerForm,
        submitButton
    };
}

function makeButton() {
    return {
        disabled: false,
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        removeAttribute(name) {
            delete this.attributes[name];
        }
    };
}

function makeClassList() {
    const values = new Set();
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        }
    };
}

function makeMessage() {
    return { textContent: "", classList: makeClassList() };
}

function makeList() {
    return {
        children: [],
        append(...children) {
            this.children.push(...children);
        },
        replaceChildren(...children) {
            this.children = [...children];
        }
    };
}

function makeForm(values, button) {
    return {
        values,
        resetCount: 0,
        addEventListener() {},
        reportValidity() {
            return true;
        },
        querySelector() {
            return button;
        },
        reset() {
            this.resetCount += 1;
        }
    };
}

test("cancelling a world action sends no write request", async () => {
    const harness = createHarness({ promptResult: "" });

    await harness.context.runWorldAction("TestWorld", "archive", makeButton());

    assert.equal(harness.promptMessages.length, 1);
    assert.equal(harness.fetchCalls.length, 0);
});

test("confirmed archive action sends the exact world name", async () => {
    const harness = createHarness();

    await harness.context.runWorldAction("TestWorld", "archive", makeButton());

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0].url, "/worlds/archive");
    assert.equal(harness.fetchCalls[0].method, "POST");
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].body), {
        name: "TestWorld",
        confirmed_name: "TestWorld"
    });
});

test("cancelling world creation sends no request", async () => {
    const harness = createHarness({ promptResult: "DifferentName" });

    await harness.context.createWorldFromForm({ preventDefault() {} });

    assert.equal(harness.fetchCalls.length, 0);
    assert.equal(harness.createForm.resetCount, 0);
});

test("confirmed world creation sends selected settings", async () => {
    const harness = createHarness();

    await harness.context.createWorldFromForm({ preventDefault() {} });

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0].url, "/worlds/create");
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].body), {
        name: "TestWorld",
        confirmed_name: "TestWorld",
        environment: "NORMAL",
        world_type: "NORMAL",
        game_mode: "SURVIVAL",
        difficulty: "NORMAL",
        generate_structures: true
    });
    assert.equal(harness.createForm.resetCount, 1);
    assert.match(harness.elements["world-create-message"].textContent, /created and loaded/);
});

test("oversized world ZIP is rejected before confirmation or upload", async () => {
    const harness = createHarness();
    harness.importForm.values.archive = new TestFile("large.zip", 256 * 1024 * 1024 + 1);

    await harness.context.importWorldFromForm({ preventDefault() {} });

    assert.equal(harness.promptMessages.length, 0);
    assert.equal(harness.fetchCalls.length, 0);
    assert.match(harness.elements["world-import-message"].textContent, /256 MiB or smaller/);
});

test("confirmed world ZIP import sends confirmation headers", async () => {
    const harness = createHarness();

    await harness.context.importWorldFromForm({ preventDefault() {} });

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0].url, "/worlds/import");
    assert.equal(harness.fetchCalls[0].method, "POST");
    assert.equal(harness.fetchCalls[0].headers["Content-Type"], "application/zip");
    assert.equal(harness.fetchCalls[0].headers["X-World-Name"], "TestWorld");
    assert.equal(harness.fetchCalls[0].headers["X-World-Confirmation"], "TestWorld");
    assert.equal(harness.fetchCalls[0].headers["X-World-Environment"], "THE_END");
    assert.equal(harness.fetchCalls[0].body.name, "world.zip");
    assert.equal(harness.importForm.resetCount, 1);
});

test("registration requires exact confirmation before writing", async () => {
    const harness = createHarness({ promptResult: "" });

    await harness.context.registerExistingWorld({ preventDefault() {} });

    assert.equal(harness.fetchCalls.length, 0);
    assert.equal(harness.registerForm.resetCount, 0);
});

test("confirmed registration sends the selected environment", async () => {
    const harness = createHarness({ promptResult: "TestWorld" });

    await harness.context.registerExistingWorld({ preventDefault() {} });

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0].url, "/worlds/register");
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].body), {
        name: "TestWorld",
        confirmed_name: "TestWorld",
        environment: "NETHER"
    });
    assert.equal(harness.registerForm.resetCount, 1);
});

test("failed world action reports the error and re-enables its control", async () => {
    const harness = createHarness({ responseStatus: 409 });
    const button = makeButton();

    await harness.context.runWorldAction("TestWorld", "unload", button);

    assert.equal(harness.fetchCalls.length, 1);
    assert.match(harness.elements["world-summary"].textContent, /Could not unload TestWorld/);
    assert.equal(button.disabled, false);
    assert.equal(button.attributes["aria-busy"], undefined);
});

test("world rows show state-appropriate lifecycle actions", () => {
    const harness = createHarness();
    const worlds = [
        { name: "LoadedWorld", environment: "NORMAL" },
        { name: "UnloadedWorld", environment: "NETHER" }
    ];
    const multiverse = [
        { name: "LoadedWorld", environment: "NORMAL", loaded: true },
        { name: "UnloadedWorld", environment: "NETHER", loaded: false },
        { name: "ArchivedWorld", environment: "THE_END", loaded: false, archived: true }
    ];

    harness.context.renderWorlds({ worlds }, { worlds: multiverse });

    const rowByName = new Map(harness.elements["worlds-list"].children.map(row => [
        row.children[1].children[0].textContent,
        row
    ]));
    const actionLabels = name => rowByName.get(name).children[3].children.map(button => button.textContent);

    assert.deepEqual(actionLabels("LoadedWorld"), ["Manage gamerules", "Unload", "Archive"]);
    assert.deepEqual(actionLabels("UnloadedWorld"), ["Load", "Archive"]);
    assert.equal(harness.elements["world-summary"].textContent, "1 loaded · 1 unloaded · 1 archived");
});

test("world state filter renders archived worlds only", () => {
    const harness = createHarness();
    harness.elements["world-state-filter"].value = "archived";
    const worlds = [{ name: "RegularWorld" }];
    const multiverse = [
        { name: "RegularWorld", loaded: false, archived: false },
        { name: "ArchivedWorld", loaded: false, archived: true }
    ];

    harness.context.renderWorlds({ worlds }, { worlds: multiverse });

    assert.equal(harness.elements["worlds-list"].children.length, 1);
    assert.equal(
        harness.elements["worlds-list"].children[0].children[1].children[0].textContent,
        "ArchivedWorld"
    );
});

test("restore control submits the exact world confirmation", async () => {
    const harness = createHarness({ promptResult: "ArchivedWorld" });
    harness.elements["world-state-filter"].value = "archived";
    const archived = { name: "ArchivedWorld", loaded: false, archived: true };
    harness.context.renderWorlds({ worlds: [] }, { worlds: [archived] });
    const restoreButton = harness.elements["worlds-list"].children[0].children[3].children[0];

    await restoreButton.listeners.click();

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0].url, "/worlds/restore");
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].body), {
        name: "ArchivedWorld",
        confirmed_name: "ArchivedWorld"
    });
});
