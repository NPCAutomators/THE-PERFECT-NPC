# ZORIN fork infrastructure checklist

The codebase now targets `NPCAutomators/AGENT-ZORIN`. The following external
resources must exist before a public release:

- GitHub repository: `https://github.com/NPCAutomators/AGENT-ZORIN`
- Raw installers on the repository's `main` branch
- Container image: `ghcr.io/npcautomators/agent-zorin`
- Python distribution: `zorin-agent`
- CLI entry point: `zorin`
- Any npm packages owned by NPCAUTOMATORS

The frontend now imports the repo-local `@npcautomators/ui` workspace package,
so builds no longer depend on a retired external UI package identity.
