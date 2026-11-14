# Dentis: a Bangla voice receptionist for a dental centre

A dental centre website: the hero's main action is **Book an appointment** (booked by voice in Bangla), with a Three.js line-art person with a toothache on the right (their face morphs to a smile on hover) and a floating **Call Dentis** button at the bottom right. A staff portal lives at `/admin`. Built for the StrategyByte AI Engineer task brief (`StrategyByte_AI_Engineer_Task_Brief_14Nov.pdf`).

- **Voice:** OpenAI Realtime API over WebRTC, straight from the browser. The Worker only mints a short-lived key.
- **Backend:** one Cloudflare Worker (vanilla JS), D1 for data, R2 for recordings. No framework, no build step, no runtime dependencies.
- **Admin:** access-key login. Staff manage the agent's knowledge ("skills"), doctors and the clinic profile, and read every call.
- **Code:** domain-driven layers, tested. Rules, decisions and contracts live in [`agentic-hub/`](agentic-hub/README.md). Agents read [`CLAUDE.md`](CLAUDE.md).

## How a call works

```
Browser ──POST /api/session {intent}──▶ StartCall: new call row, prompt built from clinic + doctors + skill titles,
   │                                  short-lived OpenAI key returned
   ├─ WebRTC audio + data channel ──▶ OpenAI Realtime (gpt-realtime, Bangla)
   ├─ model function call ──POST /api/agent/tools/:name──▶ ToolExecutor ─▶ use cases ─▶ D1
   ├─ hang up ──POST /api/calls/:id/finish──▶ transcript saved, status derived ─▶ background analysis
   └─ PUT /api/calls/:id/recording ─▶ R2
```

**Agent tools** (see [contract](agentic-hub/contracts/agent-tools.md)): `get_clinic_info`, `list_doctors`, `list_skills`, `lookup_skill`, `check_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `save_patient_details`, `request_human_callback`, `get_current_datetime`, `end_call`. Facts such as fees, hours and slots come only from these tools. Editing a skill in `/admin` changes the next call, with no deploy.

**Data model** ([contract](agentic-hub/contracts/data-model.md)): `calls`, `call_extractions`, `transcript_turns`, `patients`, `appointments`, `callbacks`, `skills`, `doctors`, `settings`. Validation lives in the domain: Bangladeshi mobile numbers (Bangla digits and `+880` accepted), real future dates within 60 days, doctor hours, one active booking per doctor and slot (also a unique index). After a call a small model adds an English summary and translation and fills gaps in the extraction. It never overrides what the tools captured.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars        # put your OPENAI_API_KEY and an ADMIN_ACCESS_KEY in it
npm run db:init:local                 # schema + Dentis demo clinic (doctors, skills)
npm run db:samples:local              # optional: 4 invented sample calls so the portal is not empty
npm run dev                           # http://localhost:8787  (admin: /admin)
npm test                              # 273 tests, no setup needed
```

## Deploy

```bash
npx wrangler d1 create dentis         # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create dentis-recordings
npm run db:init:remote
npm run db:samples:remote             # optional sample calls
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ADMIN_ACCESS_KEY
npm run deploy
```

Add a Cloudflare rate-limiting rule on `POST /api/admin/login` in production.

## Layout

```
src/domain/          entities, value objects, rules (imports nothing)
src/application/     use cases, agent prompt + tools, ports
src/infrastructure/  D1, R2, OpenAI, WebCrypto adapters
src/interface/http/  router and routes
src/composition.js   the only place that wires adapters to use cases
public/              landing page (Three.js line-art hero) and /admin SPA, plain ES modules
migrations/          0001 schema, 0002 demo clinic, 0003 optional sample calls
test/                mirrors src/, plus frontend and architecture tests
agentic-hub/         requirements, principles, epics, contracts, task commands
```

## Tests

`npm test` runs 273 tests with Node's built-in runner:

| Folder | What it proves |
|---|---|
| `test/domain` | phone, slot, availability, call status, skill ranking rules |
| `test/application` | every use case and every agent tool (success and failure paths) with in-memory ports |
| `test/infrastructure` | the **real SQL and migrations** (via a `node:sqlite` stand-in for D1), OpenAI request shapes, HMAC |
| `test/interface` | the whole HTTP API end to end: sessions, tools, finish, recording, admin auth, CRUD |
| `test/frontend` | transcript building from Realtime events, copy completeness in both languages, formatters |
| `test/architecture.test.js` | layers only import inward (fails on a bad import) |

## What is not done, honestly

- **A live voice call was not run end to end.** This build environment had no OpenAI key or microphone. Everything around the call is tested: session creation, tool execution, transcript handling, status derivation, the call panel states. The Realtime endpoint shapes (`/v1/realtime/client_secrets`, `/v1/realtime/calls`, GA event names) follow OpenAI's docs as I know them. **Make one real call first** and watch the browser console if anything differs.
- **Bangla quality is not measured.** The prompt asks for colloquial Dhaka Bangla, code-switching, digit read-back and safe behaviour. Accent and number recognition depend on the model. Read-back confirmation and the post-call analysis are the safety nets.
- **Not deployed.** I had no Cloudflare account access. The steps above are tested only against `wrangler dev` with local D1.
- **Sample calls are invented** (`0003_sample_calls.sql`). Replace them with your own test calls before submitting.
- Single shared access key, no per-user audit, no login rate limit in code.
- Out of scope: phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments. See [decisions](agentic-hub/decisions.md).

## 3-minute video outline

1. Landing page, hover the person in the hero, switch to Bangla (20 s).
2. Press **Book an appointment**, book an appointment by voice, mixing in English words, read the phone number back (90 s).
3. Open `/admin`, log in, show the call, transcript with English translation, captured fields, the appointment and the recording (45 s).
4. Edit a skill's fee in **Agent skills**, call again and ask for the price (25 s).
