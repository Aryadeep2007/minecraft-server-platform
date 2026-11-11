# Getting started: reproduce the management platform

This guide connects the repository components to a Paper server. It is **not a clean-room tested installer**: API and bridge builds, API unit tests, and CT100 read-only checks are verified, but a fresh Proxmox/LXC/Paper/Tailscale installation has not been reproduced from these instructions. Adapt CT IDs, paths, service users, and origins to your own environment.

## Prerequisites and boundaries

- A Linux host and Debian-based Minecraft container. The verified example is Proxmox VE with Debian 13 LXC, 2 vCPU, 2 GiB RAM, and a 40 GiB root disk. These are historical example values, not sizing recommendations. Check memory first; the physical example host has only 4 GiB RAM.
- Paper 1.21.11 and Java 21 for the checked-in bridge version, plus Multiverse-Core 5.5.3 for world lifecycle operations. Paper's version table lists Java 21 for Minecraft 1.20 through 1.21.11; recheck before choosing other versions. See [Paper getting started](https://docs.papermc.io/paper/getting-started/).
- A development machine with JDK 21, Maven, Python 3.12+, and Node.js 22.
- A private access proxy that authenticates users and supplies the trusted `Tailscale-User-Login` header.
- A current recoverable backup before deployment or world-changing operations. See [backup and isolated restore](backup-and-restore.md).

The bridge listens only on `127.0.0.1:25586`; FastAPI listens only on `127.0.0.1:8000`. Do not expose either port. Do not use Tailscale Funnel: it is public and does not provide this API's required identity headers. Tailscale Serve supplies identity headers for user traffic, strips caller-supplied identity headers, and is intended for private tailnet access. Keep the API reachable only through the trusted proxy. See [Tailscale Serve and identity headers](https://tailscale.com/docs/features/tailscale-serve).

## 1. Build and run repository checks

Run these commands on a **Windows development machine**, starting in PowerShell at the repository root. They do not contact a live server.

```powershell
cd paper-management-bridge
mvn --batch-mode --no-transfer-progress clean verify
cd ..
```

Expected: `BUILD SUCCESS`, eight bridge validation tests passing, and `paper-management-bridge/target/paper-management-bridge-0.1.0-SNAPSHOT.jar`. Two symlink tests may skip on Windows if creating symlinks is unavailable; Ubuntu CI should run all eight.

```powershell
cd management-api
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m compileall -q app
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..
```

Expected: compilation succeeds and 23 API tests pass. On Windows, the symlink-registration test may skip if symlink creation is unavailable. The previously deployed 17-test subset passed on CT100/Linux; the six new middleware checks run locally and in CI.

```powershell
cd web-dashboard
node --check app.js
node --test tests/*.test.cjs
cd ..
```

Expected: JavaScript syntax succeeds and 22 dashboard tests pass across moderation payloads, mocked world actions, row controls, filtering, and error recovery. They do not exercise a real browser, authenticated session, API, or Minecraft server.

## 2. Prepare Paper and the bridge

These **Linux container** steps install a plugin and change Paper settings. Back up first, wait until players are offline, and plan a clean server restart.

1. Install a Paper version compatible with the bridge's `pom.xml` and `plugin.yml`. Install Multiverse-Core 5.5.3 in the same `plugins` directory. Start Paper once, then stop it cleanly. Follow the official [Paper getting-started guide](https://docs.papermc.io/paper/getting-started/).
2. Create a private bridge-token file as root inside the CT. Adapt the account/path if your Paper service is not named `minecraft`:

   ```bash
   install -d -o minecraft -g minecraft -m 0700 /opt/minecraft-management/secrets
   runuser -u minecraft -- python3 -c 'import secrets; open("/opt/minecraft-management/secrets/bridge-token", "x").write(secrets.token_hex(32) + "\n")'
   chown minecraft:minecraft /opt/minecraft-management/secrets/bridge-token
   chmod 0600 /opt/minecraft-management/secrets/bridge-token
   stat -c '%U:%G %a' /opt/minecraft-management/secrets/bridge-token
   ```

   Expected metadata: `minecraft:minecraft 600`. The token is written to a file, not printed. If that file already exists, preserve it; do not overwrite it.
3. Install the built JAR as `PaperManagementBridge.jar` in Paper's `plugins` directory, owned by the Paper service account and mode `0644`. If Paper runs in a Proxmox CT, transfer the JAR to the Proxmox host, then run `pct push <CT_ID> <HOST_TEMP_JAR> <CT_TEMP_JAR>` on the **Proxmox host** and `pct exec <CT_ID> -- install ...` to copy it into the plugin directory. Back up an existing JAR first; do not overwrite an unknown file.
4. Configure these entries in Paper's `server.properties`, removing duplicate keys:

   ```properties
   management-server-enabled=true
   management-server-host=127.0.0.1
   management-server-port=25585
   management-server-tls-enabled=false
   management-server-secret=<40-character-alphanumeric-secret>
   ```

   Generate a fresh 40-character alphanumeric secret in a private Linux terminal and enter it locally in `server.properties`. Do not paste it into chat, Git, or a public issue. The bridge client uses `ws://127.0.0.1:25585`, so TLS must be disabled for this local-only implementation. Keep the listener on loopback. Paper documents these properties in its [server properties reference](https://docs.papermc.io/paper/reference/server-properties/).

   ```bash
   python3 -c 'import secrets,string; alphabet=string.ascii_letters+string.digits; print("".join(secrets.choice(alphabet) for _ in range(40)))'
   ```
5. Start Paper using your normal service procedure. Inside the CT, check:

   ```bash
   systemctl is-active minecraft.service
   journalctl -u minecraft.service -n 80 --no-pager
   ```

   Expected: the service is active and its startup log reports the bridge listening on loopback port 25586. Inspect logs locally and redact them before sharing.

## 3. Install and configure FastAPI

Run this on the **Linux container that hosts Paper**, so the API reaches the loopback endpoints and reads `server.properties` without copying its Management Protocol secret elsewhere.

1. Place `management-api/` and `web-dashboard/` under `/opt/minecraft-management/` or set their absolute paths in the service environment. The API service account needs read access to code/static files and secret files, plus write access to the Paper world directory for ZIP imports.
2. Create the external allowlist with one exact authenticated login per line, mode `0600`; edit it locally without printing the contents:

   ```bash
   install -o minecraft -g minecraft -m 0600 /dev/null /opt/minecraft-management/secrets/dashboard-allowed-user
   ```

   Add the login the trusted proxy sends as `Tailscale-User-Login` using an installed local editor; do not print or share the file. The API currently requires a user login, not a tagged-device identity.
3. Install the API's pinned dependencies and run its checks:

   ```bash
   cd /opt/minecraft-management
   python3 -m venv .venv
   .venv/bin/python -m pip install -r requirements.txt
   .venv/bin/python -m compileall -q app
   .venv/bin/python -m unittest discover -s tests -v
   ```

   Expected: compilation succeeds and 17 tests pass. These fresh-container commands have not yet been verified from a clean Debian install.
4. Create a private systemd environment file outside Git, for example `/opt/minecraft-management/secrets/management-api.env`, mode `0600`, readable by the API service account. Set all six variables from `management-api/.env.example` using absolute paths: allowlist file, dashboard directory, dashboard origin, bridge-token file, Paper `server.properties`, and world directory. Set the origin to the exact private HTTPS scheme and host users open, without path or trailing slash. Keep allowlist contents and secret values in their separate restricted files.
5. Create `/etc/systemd/system/minecraft-management.service` with this template, adapting the service account and paths if needed:

   ```ini
   [Unit]
   Description=Minecraft Management API
   After=network.target minecraft.service

   [Service]
   User=minecraft
   Group=minecraft
   WorkingDirectory=/opt/minecraft-management
   EnvironmentFile=/opt/minecraft-management/secrets/management-api.env
   ExecStart=/opt/minecraft-management/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

   Review the unit and paths before enabling it. Ensure the API user can read its environment, allowlist, token, and Paper properties, and can write the world directory. Then load and start it:

   ```bash
   systemctl daemon-reload
   systemctl enable --now minecraft-management.service
   systemctl status minecraft-management.service --no-pager
   ```

   Expected: systemd reports the service active. Keep the API on loopback; never bind it to `0.0.0.0` or a LAN address.

## 4. Serve the dashboard privately

On the **same Linux host as the API**, configure Tailscale Serve or an equivalent trusted private proxy to forward the HTTPS origin to `http://127.0.0.1:8000`. Verify the proxy authenticates users, overwrites identity headers, preserves the browser `Origin`, serves both `/dashboard/` and API routes on the same origin, and blocks direct access. Set the exact origin in the private service environment. Do not expose the API publicly or use Funnel.

## 5. Verify without changing worlds

Inside the **Linux CT**, check both services:

```bash
systemctl is-active minecraft.service
systemctl is-active minecraft-management.service
```

Expected: both print `active`. Open the private dashboard address ending in `/dashboard/`; the API and bridge indicators should be healthy and world lists should load. Do not click create, import, load, unload, archive, restore, or gamerule save during this read-only check.

A direct request to `http://127.0.0.1:8000/health` without a trusted identity header should return `403`; that is expected access control. Use the private proxy for browser verification. Back up before any world-changing operation.

## Troubleshooting and verification boundary

- API `403`: check proxy identity, exact allowlist login, and exact write-request Origin. Do not disable middleware.
- API `503`: check the API and Minecraft services, bridge token file permissions, loopback listener, Paper Management Protocol settings, and Multiverse status. Never print secrets.
- Dashboard opens but writes fail: ensure dashboard and API share an origin, the proxy preserves `Origin`, and the configured origin matches it exactly.
- Import extracts files but registration fails: files are retained. Refresh the world list and inspect the directory before using **Register existing world**; do not repeat the upload under the same name.
- A world-action timeout may occur after the action completes. Refresh state before retrying.
- See [troubleshooting](troubleshooting.md), [world-management safeguards](world-management.md), and [backup and isolated restore](backup-and-restore.md).

The repository's API tests, mocked dashboard workflow tests, Java bridge validation tests, and Maven build are verified. CT100 has received the API/dashboard/bridge deployment and read-only HTTP health/world-list checks; a confirmed uppercase unregistered world load was rejected before mutation. A fresh Proxmox/LXC install, new Paper setup, new Tailscale Serve setup, authenticated browser workflow, and successful live world lifecycle actions have **not** been tested from this guide.
