# Requirements

Source: `../StrategyByte_AI_Engineer_Task_Brief_14Nov.pdf`. Deadline: Mon 16 Nov 2026, 06:00 BST. Weights: Bangla caller 30%, data and portal 25%, hero and landing 20%, code quality 15%, docs 10%.

| Brief | Requirement | Epic |
|---|---|---|
| A | Dental centre landing page with 3 or more sections, hero first, a Three.js 3D hero on the right (the brief asked for a person with a toothache; the owner replaced it with an interactive 3D tooth, see decisions), responsive, bilingual toggle (a plus). Main action **Book an appointment**, floating **Call Dentis** at the bottom right | [landing](epics/landing.md) |
| B | The brief asks for a "Talk to our Bangla caller" option in the hero. Ours: **Book an appointment** (hero) and **Call Dentis** (floating), both live browser voice. Connecting, live, ended, mic and connection errors handled | [voice-call](epics/voice-call.md) |
| C | Natural Bangla receptionist: greeting, name, phone read back, reason, date and time, booking or enquiry, out-of-scope handling, summary | [voice-agent](epics/voice-agent.md) |
| C (ours) | Clinic knowledge ("skills") managed in admin and fetched by the agent through tool calls | [voice-agent](epics/voice-agent.md), [admin](epics/admin.md) |
| C (planned) | Admin edits the agent's instructions, and manages clinic details and an FAQ knowledge base that the agent uses | [knowledge](epics/knowledge.md) |
| D | Portal: call list, per-call view with extraction and transcript, login, data model for calls, patients, extractions, turns, appointments | [portal](epics/portal.md) |
| Deliverables | Public landing URL, portal URL and login, GitHub repo with README, 3-minute video | [platform](epics/platform.md) |

Guidelines from the brief: free tiers are fine, test data only, no secrets in the repo, an end-to-end solution beats a polished partial one, and say honestly what is incomplete.
