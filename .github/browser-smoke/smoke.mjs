import assert from "node:assert/strict";
import { chromium, request as playwrightRequest } from "playwright";

const baseURL = "http://127.0.0.1:8000";
const testLogin = "ci-browser@example.invalid";
const worldName = "CiBrowserFlow";
const identityHeader = { "Tailscale-User-Login": testLogin };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ extraHTTPHeaders: identityHeader });
const page = await context.newPage();
const api = await playwrightRequest.newContext({
  baseURL,
  extraHTTPHeaders: { ...identityHeader, Origin: baseURL },
});

let creationSubmitted = false;
try {
  const denied = await playwrightRequest.newContext({ baseURL });
  const deniedResponse = await denied.get("/health");
  assert.equal(deniedResponse.status(), 403, "API must reject missing identity");
  await denied.dispose();

  const response = await page.goto(`${baseURL}/dashboard/`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, "dashboard page should load");
  await page.getByRole("heading", { name: "Control Center" }).waitFor();

  await page.getByText("Create a world", { exact: true }).click();
  await page.locator("#world-create-name").fill(worldName);
  page.once("dialog", async (dialog) => {
    assert.equal(dialog.type(), "prompt");
    await dialog.accept(worldName);
  });
  creationSubmitted = true;
  await page.getByRole("button", { name: "Create world" }).click();

  const result = page.locator("#world-create-message");
  await result.getByText(`${worldName} created and loaded.`, { exact: true }).waitFor({ timeout: 190000 });
  await page.locator("#worlds-list").getByText(worldName, { exact: false }).waitFor({ timeout: 15000 });

  const listing = await api.get("/worlds/multiverse");
  assert.equal(listing.status(), 200, "authenticated world list should load");
  const body = await listing.json();
  const worlds = body.worlds ?? body;
  assert.ok(worlds.some((world) => world.name === worldName), "created world should be registered");
} finally {
  if (creationSubmitted) {
    const listing = await api.get("/worlds/multiverse");
    if (listing.ok()) {
      const body = await listing.json();
      if ((body.worlds ?? []).some((world) => world.name === worldName)) {
        const unload = await api.post("/worlds/unload", { data: { name: worldName, confirmed_name: worldName } });
        assert.equal(unload.status(), 200, `test world unload failed: ${await unload.text()}`);
        const archive = await api.post("/worlds/archive", { data: { name: worldName, confirmed_name: worldName } });
        assert.equal(archive.status(), 200, `test world archive failed: ${await archive.text()}`);
      }
    }
  }
  await api.dispose();
  await browser.close();
}

console.log("Authenticated browser flow passed: identity gate, dashboard load, create confirmation, world creation/listing, unload, and archive cleanup.");
