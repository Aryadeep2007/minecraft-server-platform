"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "app.js");
const appSource = fs.readFileSync(appPath, "utf8");

function createHarness({
    confirmResult = true,
    reason = "",
    duration = "1h"
} = {}) {
    const fetchCalls = [];
    const confirmMessages = [];

    const elements = {
        "moderation-ban-reason": {
            value: reason,
            focused: false,
            focus() {
                this.focused = true;
            }
        },
        "moderation-ban-duration": {
            value: duration,
            focused: false,
            focus() {
                this.focused = true;
            }
        },
        "player-management-message": {
            textContent: ""
        }
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
                disabled: false,
                textContent: "",
                className: "",
                append(...items) {
                    this.children.push(...items);
                },
                replaceChildren(...items) {
                    this.children = [...items];
                },
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                removeAttribute(name) {
                    delete this.attributes[name];
                },
                addEventListener() {}
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
        confirm(message) {
            confirmMessages.push(String(message));
            return confirmResult;
        }
    };

    async function mockFetch(url, options = {}) {
        fetchCalls.push({
            url: String(url),
            method: (options.method || "GET").toUpperCase(),
            body: options.body || null
        });

        // Every request stays inside this test harness.
        // No real API or Minecraft server is contacted.
        return {
            ok: true,
            status: 200,
            async json() {
                return { players: [] };
            }
        };
    }

    const context = vm.createContext({
        window,
        document,
        fetch: mockFetch,
        AbortController,
        console,
        setTimeout,
        clearTimeout
    });

    // Prevent the dashboard's normal page-load requests.
    // All moderation tests invoke the real handlers explicitly.
    const startupCalls = /\nrefreshDashboard\(\);\r?\nloadPlayerManagement\(\);\s*$/;

    assert.match(
        appSource,
        startupCalls,
        "Expected the dashboard's automatic startup calls at the end of app.js"
    );

    const isolatedSource = appSource.replace(startupCalls, "\n");
    vm.runInContext(isolatedSource, context, {
        filename: "app.js"
    });

    function writeCalls() {
        return fetchCalls.filter(
            (call) => call.method === "POST" || call.method === "DELETE"
        );
    }

    return {
        context,
        elements,
        fetchCalls,
        confirmMessages,
        writeCalls
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

const identity = {
    name: "TestPlayer",
    id: "test-player-id-123"
};

test("player identity requires a name and server-provided ID", () => {
    const harness = createHarness();

    const valid = harness.context.getPlayerIdentity({
        name: "TestPlayer",
        id: "test-player-id-123"
    });

    assert.equal(valid.name, "TestPlayer");
    assert.equal(valid.id, "test-player-id-123");

    assert.equal(
        harness.context.getPlayerIdentity({
            name: "TestPlayer"
        }),
        null
    );

    assert.equal(
        harness.context.getPlayerIdentity({
            id: "test-player-id-123"
        }),
        null
    );
});

test("blank ban reason is rejected without a request", async () => {
    const harness = createHarness({ reason: "" });

    await harness.context.banPlayer(identity, makeButton());

    assert.equal(harness.fetchCalls.length, 0);
    assert.match(
        harness.elements["player-management-message"].textContent,
        /Enter a reason/
    );
    assert.equal(
        harness.elements["moderation-ban-reason"].focused,
        true
    );
});

test("missing player ID is rejected without a request", async () => {
    const harness = createHarness({ reason: "Test reason" });

    await harness.context.banPlayer(
        { name: "TestPlayer", id: "" },
        makeButton()
    );

    assert.equal(harness.fetchCalls.length, 0);
});

test("cancelling Ban sends no request", async () => {
    const harness = createHarness({
        confirmResult: false,
        reason: "Automated test only",
        duration: "1h"
    });

    await harness.context.banPlayer(identity, makeButton());

    assert.equal(harness.confirmMessages.length, 1);
    assert.match(harness.confirmMessages[0], /TestPlayer/);
    assert.match(harness.confirmMessages[0], /1 hour/);
    assert.equal(harness.writeCalls().length, 0);
});

test("timed Ban sends the expected payload and ISO expiry", async () => {
    const harness = createHarness({
        confirmResult: true,
        reason: "Automated test only",
        duration: "1h"
    });

    const before = Date.now();

    await harness.context.banPlayer(identity, makeButton());

    const after = Date.now();
    const writes = harness.writeCalls();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "POST");
    assert.equal(writes[0].url, "/player/bans");

    const payload = JSON.parse(writes[0].body);

    assert.deepEqual(payload.player, identity);
    assert.equal(payload.reason, "Automated test only");
    assert.equal(payload.source, "Management API");
    assert.equal(typeof payload.expires, "string");

    const expiry = Date.parse(payload.expires);

    assert.ok(Number.isFinite(expiry), "Expiry must be a valid timestamp");
    assert.ok(
        expiry >= before + 59 * 60 * 1000 &&
        expiry <= after + 61 * 60 * 1000,
        "Expiry should be approximately one hour ahead"
    );

    assert.equal(
        new Date(expiry).toISOString(),
        payload.expires,
        "Expiry should use ISO 8601 format"
    );
});

test("permanent Ban sends a null expiry", async () => {
    const harness = createHarness({
        confirmResult: true,
        reason: "Automated permanent-ban payload test",
        duration: "permanent"
    });

    await harness.context.banPlayer(identity, makeButton());

    const writes = harness.writeCalls();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "POST");
    assert.equal(writes[0].url, "/player/bans");

    const payload = JSON.parse(writes[0].body);

    assert.equal(payload.expires, null);
    assert.match(harness.confirmMessages[0], /Permanent/);
});

test("Kick sends the expected player identity and message", async () => {
    const harness = createHarness({ confirmResult: true });

    await harness.context.kickPlayer(identity, makeButton());

    const writes = harness.writeCalls();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "POST");
    assert.equal(writes[0].url, "/player/kick");

    const payload = JSON.parse(writes[0].body);

    assert.deepEqual(payload.player, identity);
    assert.equal(
        payload.message,
        "Kicked by server administrator"
    );
});

test("cancelling Kick sends no request", async () => {
    const harness = createHarness({ confirmResult: false });

    await harness.context.kickPlayer(identity, makeButton());

    assert.equal(harness.confirmMessages.length, 1);
    assert.equal(harness.writeCalls().length, 0);
});

test("Unban sends the expected player identity", async () => {
    const harness = createHarness({ confirmResult: true });

    await harness.context.removeBan(identity, makeButton());

    const writes = harness.writeCalls();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "DELETE");
    assert.equal(writes[0].url, "/player/bans");

    const payload = JSON.parse(writes[0].body);

    assert.deepEqual(payload.player, identity);
});

test("cancelling Unban sends no request", async () => {
    const harness = createHarness({ confirmResult: false });

    await harness.context.removeBan(identity, makeButton());

    assert.equal(harness.confirmMessages.length, 1);
    assert.equal(harness.writeCalls().length, 0);
});