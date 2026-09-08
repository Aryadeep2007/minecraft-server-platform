\# Hardware



\## Server Hardware



| Component | Specification |

|---|---|

| Motherboard | Gigabyte H310M S2 2.0 |

| CPU | Intel Core i3-9100F |

| CPU Cores | 4 cores / 4 threads |

| CPU Speed | 3.60 GHz |

| GPU | NVIDIA GT 710 2 GB |

| RAM | 4 GB DDR4-2400 |

| Storage | 1 TB Toshiba SATA HDD |

| PSU | iBall ZPS-281 |



\## Current Limitations



The server currently has 4 GB of RAM and a mechanical HDD.



The current Minecraft deployment is therefore configured conservatively:



\- Minecraft LXC RAM: 2 GB

\- Minecraft CPU: 2 cores

\- Java heap: 1 GB minimum / 1 GB maximum



\## Upgrade Plan



Planned future upgrades:



\- Increase RAM to at least 8 GB, preferably 16 GB.

\- Add a SATA SSD for Proxmox and active workloads.

\- Use the HDD primarily for backups and bulk storage.



\## Notes



The Intel Core i3-9100F does not have integrated graphics, so the GT 710 is currently used for local display output.



The server is designed to run continuously and is currently configured to automatically power back on after an electrical outage.

