# CLAUDE.md

Rules for any AI coding agent working in this repo. `AGENTS.md` points here, so all tools follow the same rules.

**Dentis** is a dental centre website (landing page with a Three.js line-art hero) with an OpenAI Realtime Bangla voice agent and an admin portal at `/admin`. Cloudflare Workers, vanilla JS, D1, R2.

## Start

Read [agentic-hub/README.md](agentic-hub/README.md) first. The hub holds everything that decides what we build:

- [requirements](agentic-hub/requirements.md): the StrategyByte brief, mapped to epics
- [principles](agentic-hub/principles.md): domain-driven layers, YAGNI, tests, safety
- [decisions](agentic-hub/decisions.md): decided, assumed and out of scope
- [epics](agentic-hub/epics/README.md): scope and acceptance per area
- [contracts](agentic-hub/contracts/README.md): HTTP API, agent tools, data model
- [commands](agentic-hub/commands/README.md): `/create-task` and `/task-loop`; tasks live in `agentic-hub/tasks/`

## Conventions

- **Contract first.** Change the contract doc in the same change as the code.
- **Grouped by part, YAGNI.** `src/` is grouped by part of the app: `admin`, `website`, `scheduling`, `knowledge`, `clinic`, `calls`, `agent`, `shared`. See principle 2. Build only what the current task needs.
- **Tests with code**, under `test/`, mirroring `src/`. Run `npm test` before you say a change is done.
- **Tasks live in the hub.** A feature is one file in `agentic-hub/tasks/`, created with `/create-task` and run with `/task-loop`. Branch: `feature/<task-id>`.
- **Open choices** are in `decisions.md`. Do not build on an open one without telling the user which default you used.
- **Secrets** never go in the repo. Use `.dev.vars` locally and Wrangler secrets in production. Fake patient data only.
- **Never overwrite, truncate or delete `.dev.vars`.** It holds the owner's real keys and cannot be recovered. To test locally pass fake values on the command line: `npx wrangler dev --var OPENAI_API_KEY:x --var ADMIN_ACCESS_KEY:local-test-key` (command-line vars win over the file, and a fake key avoids real OpenAI calls).
- **Docs style:** short, plain sentences.
- **Git:** small logical commits. Do not push or merge unless the user asks, except what `/task-loop` allows.
