\# Minecraft Server Platform



A self-hosted Minecraft server and community management platform built as a first-year engineering project.



\## Current Stack



\- Proxmox VE 9.2.11

\- Debian 13 (Trixie)

\- PaperMC 1.21.11

\- Java 21

\- Proxmox LXC

\- Git \& GitHub



\## Hardware



\- CPU: Intel Core i3-9100F

\- RAM: 4 GB DDR4-2400

\- Storage: 1 TB SATA HDD

\- GPU: NVIDIA GT 710 2 GB

\- Motherboard: Gigabyte H310M S2 2.0



\## Current Status



\- \[x] Proxmox installed

\- \[x] Minecraft LXC created

\- \[x] Java installed

\- \[x] PaperMC installed

\- \[x] Minecraft server running

\- \[x] Server accessible over LAN

\- \[x] Whitelist configured

\- \[ ] Minecraft plugins

\- \[ ] Discord bot

\- \[ ] Minecraft-Discord integration

\- \[ ] Automated backups

\- \[ ] Web dashboard

\- \[ ] Monitoring

\- \[ ] Custom Paper plugin



\## Architecture



```text

Internet / LAN

&#x20;     |

&#x20;  Router

&#x20;     |

&#x20;  Proxmox

&#x20;     |

&#x20;  LXC CT 100

&#x20;     |

&#x20;  PaperMC

&#x20;     |

&#x20;Minecraft

