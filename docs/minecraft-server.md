# Minecraft Server

> PaperMC-based Minecraft Java server running inside a Debian LXC container on Proxmox VE.

---

## 📊 Server Overview

| Component | Configuration |
|---|---|
| Minecraft | 1.21.11 |
| Server Software | PaperMC |
| Paper Build | 132 |
| Java | OpenJDK 21 |
| Container | Proxmox LXC 100 |
| Container RAM | 2 GB |
| CPU | 2 cores |
| Server IP | `192.168.1.200` |
| Minecraft Port | `25565` |
| Server Directory | `/opt/minecraft` |

---

## 🏗️ Architecture

```text
Internet / LAN
      │
      ▼
   Router
      │
      ▼
 Proxmox VE
 192.168.1.250
      │
      ▼
 LXC 100 — minecraft
 192.168.1.200
      │
      ▼
    PaperMC
      │
      ▼
 Minecraft 1.21.11