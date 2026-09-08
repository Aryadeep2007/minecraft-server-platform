\# Proxmox VE



\## Proxmox Host



| Item | Value |

|---|---|

| Proxmox VE | 9.2.11 |

| Hostname | pve |

| IP Address | 192.168.1.250 |

| Gateway | 192.168.1.1 |

| Bridge | vmbr0 |

| Physical NIC | nic0 |

| OS Base | Debian 13 (Trixie) |

| Architecture | x86-64 |



\## Storage



The Proxmox host currently uses a 1 TB SATA HDD.



The main storage layout is:



\- EFI partition: \~1 GB

\- Root LV: 96 GB

\- Swap: 4 GB

\- LVM thin pool: \~797.7 GB

\- Free VG space: \~16 GB



The storage is currently sufficient for the initial Minecraft deployment.



\## Network



The Proxmox bridge `vmbr0` provides network connectivity to the host and LXC containers.



The host uses:



\- IP: `192.168.1.250/24`

\- Gateway: `192.168.1.1`

\- DNS: `192.168.1.1`



\## Minecraft Container



Minecraft runs inside:



\- Container ID: `100`

\- Hostname: `minecraft`

\- OS: Debian Trixie

\- RAM: 2048 MB

\- CPU: 2 cores

\- Network: `vmbr0`

\- IP: `192.168.1.200/24`



\## Repositories



Enabled repositories:



\- Debian Trixie

\- Debian Trixie Updates

\- Debian Security

\- Proxmox `pve-no-subscription`



The Proxmox enterprise repository is disabled because this server does not use a Proxmox subscription.



\## Power Recovery



The motherboard BIOS is configured with:



`AC BACK = Always On`



This allows the server to automatically power back on after an electrical outage, provided mains power is restored.



\## Security



Proxmox Web UI is available on port `8006`.



SSH is available on port `22`.



These management services should remain accessible only from the trusted LAN and should not be exposed directly to the public Internet.

