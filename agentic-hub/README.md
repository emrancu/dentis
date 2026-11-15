# Agentic hub

The hub for **Dentis**: a dental centre website with a Bangla voice agent and an admin portal. It is built for the StrategyByte AI Engineer task brief (`../StrategyByte_AI_Engineer_Task_Brief_14Nov.pdf`). The hub lives in this repo, next to the code. Everything that decides what we build lives here.

All work must follow the [principles](principles.md) and the [contracts](contracts/README.md).

- [requirements.md](requirements.md): what the brief asks for, mapped to epics
- [principles.md](principles.md): how we build (grouped by part, YAGNI, tests)
- [decisions.md](decisions.md): what is decided, assumed and out of scope
- [epics/](epics/README.md): one file per product area
- [contracts/](contracts/README.md): HTTP API, agent tools and data model
- [commands/](commands/README.md): `/create-task` and `/task-loop`
- [outcomes/](outcomes/): one short file per finished task
- `tasks/`: one file per feature in progress, created by `/create-task`, deleted when done
