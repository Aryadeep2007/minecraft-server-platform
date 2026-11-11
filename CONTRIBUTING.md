# Contributing

Thanks for your interest in the Minecraft Server Platform. The repository is being developed incrementally; live infrastructure configuration and secret files are intentionally not tracked.

## Before proposing a change

- Check the README and relevant docs so the change matches the current implementation.
- For larger changes, open an issue or discussion first to agree on scope.
- Keep pull requests focused and explain the problem, approach, execution environment, and any operational impact.
- Do not include private IP addresses, MAC addresses, SSH targets, tunnel identities, player details, passwords, tokens, or private keys.

## Development commands

Run each block in a Windows PowerShell window from the repository root. After each block, return to the root before running the next.

```powershell
cd paper-management-bridge
mvn --batch-mode --no-transfer-progress clean verify
cd ..
```

```powershell
cd web-dashboard
node --test tests/*.test.cjs
cd ..
```

```powershell
cd management-api
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m compileall -q app
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The dashboard tests use mocked requests and do not test a live API or Minecraft server. The FastAPI validation tests do not contact Paper or Multiverse. See [management-api setup](management-api/README.md) for environment requirements; these commands do not provision live services or private configuration.

## Operational changes

Do not deploy bridge, API, dashboard, storage, or network changes to a live server as part of a pull request. Include a rollback plan for operational changes and obtain explicit owner approval before deployment or destructive world operations.

## Licensing

No license has been selected for this repository. Do not assume that public visibility grants permission to reuse or redistribute code. Discuss licensing with the maintainer before contributing code that depends on a particular license or third-party terms.
