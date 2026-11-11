# Security policy

## Reporting a vulnerability

Do not publish exploit details, credentials, or private infrastructure information in a public issue. Contact the repository maintainer privately through GitHub and include only the minimum information needed to reproduce the issue. If GitHub private vulnerability reporting is enabled for this repository, use that channel.

Do not send passwords, private keys, bearer tokens, Tailscale keys, or live player data in a report.

## Supported code

This is a personal project under active development. Security fixes are considered for the current default branch. No response-time or release-time guarantee is made.

## Security expectations

- Keep the Paper bridge bound to loopback and protect it with its bearer token.
- Keep management access behind an authenticated private access layer.
- Never commit secrets or private infrastructure inventories.
- Validate all world names, gamerule inputs, paths, and archives at the API boundary.
- Require authorization, dependency checks, backups, and explicit confirmation for destructive world operations.
- Do not execute arbitrary shell commands based on dashboard or API input.
