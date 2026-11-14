# Dentis platform: API, voice agent, landing page, portal, tests

- Task id: `dentis-platform`
- Epic: [landing](../epics/landing.md), [voice-call](../epics/voice-call.md), [voice-agent](../epics/voice-agent.md), [portal](../epics/portal.md), [admin](../epics/admin.md), [platform](../epics/platform.md)
- Contracts: [http-api](../contracts/http-api.md), [agent-tools](../contracts/agent-tools.md), [data-model](../contracts/data-model.md)
- PR plan: one for all
- Branch: `feature/dentis-platform` (the folder is not a git repo yet, so nothing was committed on a branch)
- Pull request: none yet

This task file was written after the work, so the markers show what was actually done.

## Goal
A visitor talks to the Bangla agent from the hero and books a real appointment. Staff log in at `/admin`, see the call, transcript and data, and manage what the agent knows.

## Spec
Domain-driven layers and YAGNI as in the principles. Voice is OpenAI Realtime. Tests use `node:test`.

## Approved deviations
None.

## Subtasks

- [x] 1. Hub docs and contracts
  - parallel: no
  - what: `agentic-hub/`, root `AGENTS.md`, `CLAUDE.md`, `.claude/commands`
  - done when: contracts list every endpoint, tool and table
- [x] 2. Domain layer and tests
  - parallel: no (after 1)
  - files: `src/domain/`, `test/domain/`
  - done when: domain tests pass
- [x] 3. Application layer and tests
  - parallel: no (after 2)
  - files: `src/application/`, `test/application/`, `test/support/`
  - done when: every tool in the contract has a success and a failure test
- [x] 4. Infrastructure adapters and tests
  - parallel: yes
  - files: `src/infrastructure/`, `migrations/`, `test/infrastructure/`
  - done when: adapter tests pass and the real SQL runs on a local D1
- [x] 5. HTTP interface, composition, architecture test
  - parallel: no (after 3, 4)
  - files: `src/interface/`, `src/composition.js`, `src/index.js`, `test/interface/`, `test/architecture.test.js`
  - done when: route tests pass, `wrangler dev` answers every endpoint, a bad import fails the architecture test
- [x] 6. Landing page, Three.js line-art hero and browser call client
  - parallel: yes (after 5)
  - files: `public/index.html`, `public/css/`, `public/js/`, `public/logo*.svg`
  - done when: hero and all sections render at 360 to 1440 px with no horizontal scroll, call states are designed, copy exists in both languages
- [x] 7. Admin portal
  - parallel: yes (after 5)
  - files: `public/admin/`
  - done when: login, overview, calls with transcript, appointments, follow-ups, patients, skills, doctors, clinic profile and data pages work against the local API
- [x] 8. README
  - parallel: no (after 6, 7)
  - done when: a fresh clone can run, test and deploy from it, and it lists what is incomplete
- [~] 9. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: see below
  - spec changes: the site became a dental centre first. The hero main action is Book an appointment, with a floating Call Dentis button. `POST /api/session` takes an optional `intent`. The hero headline is about dental care only, with no booking or speed wording (principle 14, 15). Skills lost `category` and order (YAGNI). Calls gained statuses `rescheduled` and `cancelled`. `FinishCall` is idempotent. Contracts match the code.
  - done when: a real voice call has been made and the premortem is checked against it

### Premortem
Imagine the demo failed in front of the reviewer.

| Likely cause | Covered by |
|---|---|
| The Realtime endpoint or event names differ from what the client expects | **Not covered: no live call was run.** First action: one real call, watch the console. The transcript builder accepts both old and new event names. |
| Bangla speech is misheard (names, digits) | Digit-by-digit read-back and confirmation in the prompt, phone validation with a coded retry message, post-call analysis fills gaps. Quality itself is unmeasured. |
| Microphone blocked or no mic | Mic-denied and no-mic states with instructions and retry. |
| Visitor never hangs up, or closes the tab | 5-minute cap, `sendBeacon` finish on page close, calls stuck `in_progress` become `incomplete` after 30 minutes. |
| The model books a slot that is taken | The slot is re-checked at booking time, a unique index forbids a double booking, alternatives are offered. |
| Someone abuses the open session endpoint | 10 sessions per IP per hour, 5-minute calls, short-lived key, API key stays on the server. |
| Staff cannot see the call | Finish stores turns even with zero speech, status derived, portal tests cover the path. |
| Admin key guessed | Constant-time compare, HttpOnly cookie. **No rate limit in code**: add a Cloudflare rule. |
| WebGL missing or reduced motion | A small static tooth drawing is the fallback. The 3D scene stops moving under `prefers-reduced-motion`. |
| Re-running the seed duplicates data | Seed inserts are guarded and a test runs the seed twice. |
| Recording fails | Best effort. A failure never affects the call. |

## Feature pull requests
- [ ] Pull request opened after the premortem
