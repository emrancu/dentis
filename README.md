# Dentis: a Bangla voice receptionist for a dental centre

A dental centre website where a visitor presses **Book an appointment** and talks to a Bangla-speaking AI receptionist in the browser. The agent greets, takes name and phone number, finds a free slot, books, reschedules or cancels, answers questions from clinic knowledge, and hands over to a human when it should. Staff see every call, its transcript, the captured fields, bookings and callback requests in an admin portal, and can change the agent's prompt and knowledge without a deploy.

**Live:** website https://dentis.emrancu1.workers.dev, staff portal https://dentis.emrancu1.workers.dev/admin (login is sent with the submission), code https://github.com/emrancu/dentis

This README is for engineers. It explains how the system is built and why. Rules, decisions and contracts are in [`agentic-hub/`](agentic-hub/README.md). AI coding agents read [`CLAUDE.md`](CLAUDE.md).

## Contents

1. [Architecture](#architecture)
2. [Repository layout](#repository-layout)
3. [The agentic hub, in short](#the-agentic-hub-in-short)
4. [The voice agent](#the-voice-agent)
5. [Data model](#data-model)
6. [Scheduling rules](#scheduling-rules)
7. [HTTP API](#http-api)
8. [Admin portal](#admin-portal)
9. [Website](#website)
10. [Security](#security)
11. [Tests](#tests)
12. [Run locally and deploy](#run-locally-and-deploy)
13. [Design decisions and trade-offs](#design-decisions-and-trade-offs)
14. [Known limits](#known-limits)

## Architecture

```
   mic ──▶ ElevenLabs Scribe v3 Live (Bangla, WebSocket, one-use token)
   Browser ◀─────────────────────────────────────────────┘
   (website)  ── caller turn ──▶ Worker ──▶ OpenAI GPT mini (streamed, tools)
      ▲  ▲                         │  └──▶ D1 (tools run here)
      │  └── reply text, SSE ◀─────┘
      └──── PCM audio, per sentence ◀── Worker ◀── ElevenLabs eleven_v4_turbo
   Static files: Workers Assets (public/)         (src/, vanilla JS)
```

- **Three providers, one job each.** ElevenLabs Scribe v3 Live hears Bangla, an OpenAI mini model thinks and calls tools, ElevenLabs `eleven_v4_turbo` speaks. The brain is behind `OpenAIBrain` and the voice behind `ElevenLabsVoice`, so either can be swapped.
- **Keys stay on the server.** The browser gets only a one-use, 15-minute Scribe token. The OpenAI and ElevenLabs keys never leave the Worker, which also streams the speech audio to the browser.
- **The model has no facts of its own.** Prices, hours, slots and bookings come from tool calls. The Worker runs each tool against D1 inside the turn, and the result goes back to the model.
- **One Worker, no framework, no build step, no runtime dependencies.** Vanilla JS ES modules in the Worker and in the browser. `wrangler` is the only dev dependency.

## Repository layout

Code is grouped by part of the app. A folder holds the rules, use cases and database code for one part.

```
src/
  index.js              Worker entry: builds D1 stores, OpenAI brain, ElevenLabs voice, security, then the app
  composition.js        wires stores into use cases (the only place that knows both)
  app.js                the HTTP app: website routes + admin routes + the admin guard
  scheduling/           doctors, appointments, slots, availability, phone numbers, patients (rules, use cases, store.js)
  calls/                calls, transcript turns, extractions, callback requests, status rules (rules, use cases, store.js)
  agent/                prompt builder, tool definitions, tool executor, editable agent settings, turn runner, OpenAI brain, ElevenLabs voice
  knowledge/            agent knowledge entries ("skills") and the get_skill use case (+ store.js)
  clinic/               clinic profile and settings (+ store.js)
  admin/                staff API: routes/ (one file per area), login, session guard, dashboard queries
  website/              public site data, the voice-call API, the SEO home page
  shared/               errors, time (Asia/Dhaka), Bangla digits, router and response helpers
public/
  index.html            the website, served at /
  website/              css/ and js/ for the website: Three.js hero, call client (voice.js), i18n
  admin/                the staff portal: index.html, admin.css, js/ and js/pages/ (one file per page)
  shared/util.js        formatters used by both
  fonts/, vendor/       self-hosted fonts and Three.js
migrations/             numbered D1 migrations, applied once and tracked by wrangler
seed/sample_calls.sql   optional invented sample calls (not a migration)
test/                   mirrors src/ and public/; plus architecture.test.js
agentic-hub/            requirements, principles, decisions, epics, contracts
```

**Import rules** (enforced by `test/architecture.test.js`): `shared` imports nothing. A business area (`scheduling`, `knowledge`, `clinic`, `calls`, `agent`) may use `shared` and the other areas. `admin` and `website` use `shared` and the areas, never each other. Only `index.js` imports the outside adapters (`store.js` files, `agent/realtime-gateway.js`, `admin/security.js`). Rules live in the area's entity or domain-service files, never in routes, SQL or the front end.

## The agentic hub, in short

`agentic-hub/` is the project's written memory for AI coding agents and for people. It holds what decides what we build, so an agent does not guess:

| File or folder | What it holds |
|---|---|
| `requirements.md` | the StrategyByte brief, mapped to epics |
| `principles.md` | how we build: contract first, grouped by part, YAGNI, tests with code, safety |
| `decisions.md` | what is decided, assumed and out of scope. An open choice stays a line here, not code |
| `epics/` | scope and acceptance per product area |
| `contracts/` | the HTTP API, the agent tools and the data model. Written before the code |
| `commands/` | the two workflows below |
| `tasks/` and `outcomes/` | a feature in progress, and a one-file record when it is done |

**How work flows.** An agent reads `CLAUDE.md`, which points to the hub, then follows two commands:

1. **`/create-task <details>`** plans a feature into `tasks/<id>.md`: a goal, a spec, and subtasks that say whether they can run in parallel and when each is done. The plan is checked against the principles, the epic and the contracts first. Breaking a rule needs a human to approve it in two separate asks. The last subtask is always a **premortem and spec re-evaluation**.
2. **`/task-loop <id>`** runs that file on branch `feature/<id>`. For each subtask it marks `[~]`, changes the contract before the code that uses it, writes the tests with the code, checks "done when" and `npm test`, commits, then marks `[x]`. After the premortem it opens one pull request into `main`. It never pushes to `main`, merges or force-pushes.

When the pull request is merged, `outcomes/<id>.md` records what was done, open risks move into the epic, and the task file is deleted. Anything worth keeping has by then moved into the contracts, the epic or `decisions.md`.

## The voice agent

### Call lifecycle

```
1  Browser   getUserMedia (mic)                    → mic_denied / no_mic handled before anything else
2  Browser   POST /api/session                     → StartCall: key check, rate limit, call row, one-use Scribe URL
3  Browser   opens the Scribe WebSocket; the mic is streamed as 16 kHz PCM (AudioWorklet)
4  Browser   speaks the scripted greeting (POST /api/voice/speak), starts the timer and silence watch
5  Scribe    partial transcripts (barge-in) and a committed transcript when the caller's turn is over
6  Browser   POST /api/agent/turn {call_id, messages, intent}  → Worker streams GPT mini, runs tools on D1
7  Worker    SSE: text deltas, new history (tool rounds, final reply), end_call
8  Browser   cuts the text into sentences; each goes to POST /api/voice/speak at once; PCM plays gapless
9  Model     end_call → Browser speaks the scripted closing line, hangs up when the audio ends
10 Browser   POST /api/calls/:id/finish {turns, reason} → transcript saved, status derived
```

The browser side is `public/website/js/voice.js` (state machine: `idle → connecting → live → ended | error`, plus a phase while live: listening, thinking, speaking). Pure logic is split into small testable modules: `sentences.js` (streamed text to sentences), `sse.js`, `pcm.js` (PCM decoding and gapless playback), `scribe.js` (Scribe messages), `transcript.js`, `idle.js` (silence clock), `call-messages.js`. `mic-worklet.js` is the AudioWorklet that downsamples the mic.

**Feeling real time.** Every step streams. The reply is spoken from its first clause, not its first full sentence. Before a slow tool the agent says a short phrase ("এক সেকেন্ড, দেখে নিচ্ছি।") so there is never silence. The clinic address, phone, hours and doctors are in the prompt, so the common questions need no tool round trip. The date sits at the end of the prompt so OpenAI can cache the long fixed part.

**Barge-in.** While the agent thinks or speaks, a partial transcript from Scribe plus real sound on the caller's mic aborts the turn: the SSE request is cancelled, the audio player stops at once and queued sentences are dropped. The history keeps only what was actually spoken. Echo cancellation is on; headphones give the best result.

**Recovery.** A dropped speech socket gets a new one-use URL (`POST /api/voice/listen`), up to 3 times. A failed brain turn gets a spoken apology and the call goes on; three failures in a row end it. A failed speech request skips that sentence.

### Session creation (`calls/call-records.js`, `StartCall`)

- **Rate limit:** 10 calls per hour per network. The IP is hashed (SHA-256 with a prefix) and only the hash is stored in `calls.ip_hash`.
- **Stale calls:** a call still `in_progress` after 30 minutes is marked `incomplete` on the next session start.
- **Prompt:** built fresh for every turn (`agent/agent-turn.js`) from live data: clinic profile, active doctors, enabled knowledge titles and today's date in Dhaka. An edit in admin applies from the next turn.
- **Intent:** the browser sends it with every turn. The hero button sends `booking`, which adds an instruction to go straight to the booking flow. Any other value is a general call.
- **Provider settings:** brain Gemini `gemini-3.1-flash-lite` when `GEMINI_API_KEY` is set (free tier, OpenAI-compatible endpoint, `GEMINI_MODEL` overrides; first byte about 1-1.5 s in a quick test; the bigger flash models were slow or overloaded), else `gpt-4.1-mini` (`OPENAI_MODEL` overrides; a `gpt-5*` model automatically gets minimal reasoning and low verbosity). Measured through the Worker, `gpt-4.1-mini` speaks its first word in 0.9-1.2 s and steadily, while `gpt-5-mini` ranged 1.0-2.8 s. Speech-to-text `scribe_v3_live`, `language_code=bn`, `commit_strategy=turn_prediction` (the model judges when the caller has finished, so a pause between phone digits is not the end of a turn) with a 0.8 s silence fallback. Text-to-speech `eleven_v4_turbo` (`ELEVENLABS_TTS_MODEL` overrides), raw `pcm_24000`, `language_code=bn`, default voice the premade "Sarah" (`ELEVENLABS_VOICE_ID` overrides with a Bangla library voice). Flash v2.5 is faster but its language list has no Bangla; Eleven v4 Turbo lists Bengali and is the real-time model.
- If a key is missing, `POST /api/session` answers 503 `not_configured` and the page says so. If minting the Scribe URL fails, the call is marked `failed` and the browser shows a retry panel.

### The prompt (`agent/prompt.js` and `agent/agent-prompt.js`)

The prompt is two layers. The order matters, because the last section tells the model that the locked rules win over anything above.

| Layer | Content | Who can change it |
|---|---|---|
| **Editable** | persona and tone (`Instructions`, up to 4000 chars), `Greeting` (300), `Closing` (300). `{clinic}` becomes the clinic name. Empty means the built-in default. | Staff, in `/admin/#/agent` |
| **Locked, in code** | Today (date, weekday, "evening" means 17:00 to 20:00) · Call flow (9 steps) · Facts always come from tools · Human handoff · Safety · Clinic summary and doctors · Knowledge titles · "these sections take priority" | Developers |

The call flow is: greet, name, phone (saved first, see below), reason, date and time (`check_availability`, real slots only), read back everything before `book_appointment`, reschedule or cancel with explicit confirmation, `save_patient_details` as details are learned, summary then `end_call`.

Default persona rules: colloquial Dhaka Bangla, keep common English words as Bangladeshis say them (appointment, doctor, scaling), one or two short sentences, one question at a time, dates with weekday, patience while a caller looks something up. If the caller speaks only English, the agent continues in English.

### Tools (`agent/tools.js`, `agent/tool-executor.js`)

Eleven tools. Every result is `{ ok: true, … }` or `{ ok: false, error: "<code>", message: "<what the agent should do>", … }`, always HTTP 200, so the model gets guidance instead of an exception. Domain errors become `ok:false` with a stable code. Anything else is a real 500. Full schemas: [contracts/agent-tools.md](agentic-hub/contracts/agent-tools.md).

| Tool | What it does | Side effects |
|---|---|---|
| `get_current_datetime` | date, time, weekday in Dhaka | none |
| `get_clinic_info` | name, phone (+ `phone_spoken`), address, directions, hours | none |
| `list_doctors` | active doctors with specialty, days, hours | none |
| `get_skill` | details of one knowledge entry by exact title | none |
| `check_availability` | free slots on a date, optional doctor and part of day (max 8) | none |
| `book_appointment` | books a slot, registers the patient, records the outcome | appointment, patient, extraction |
| `reschedule_appointment` | moves the caller's upcoming appointment | appointment, extraction |
| `cancel_appointment` | cancels it | appointment, extraction |
| `save_patient_details` | saves name, phone, reason, preferred time, intent, notes as they are learned | extraction, patient |
| `request_human_callback` | records a handoff for staff, `urgent` for emergencies | callback, extraction |
| `end_call` | signals that the caller needs nothing more | none (the browser says the closing and hangs up) |

Guards in `ToolExecutor.execute`: unknown tool or call is an HTTP 404, a finished call is refused, and a call older than 5 minutes plus 15 seconds gets `call_time_limit` so a client that forgot to hang up cannot keep working.

### Phone numbers: one standard path

Voice models read digits unreliably, and a Bangla voice tends to say them in Bangla words. So the number is never spoken from the model's own text.

1. The agent saves the number with `save_patient_details` as soon as it has it.
2. The server normalises it (`০১৭১২৩৪৫৬৭৮`, `+880 1712-345678` and `1712345678` all become `01712345678`) and validates it as a Bangladeshi mobile number. An invalid number returns `phone_invalid` at once, so the agent asks again.
3. The result contains `phone_spoken`: `zero one seven, one two three four, five six seven eight`. The prompt tells the agent to read the number back with exactly that text. `get_clinic_info`, `book_appointment` and `request_human_callback` return it too.

### Knowledge: titles in the prompt, details by tool

The prompt lists the **title of every enabled knowledge entry** and never the details. The model decides from the titles which entries a question needs (usually one, sometimes up to four) and fetches each with `get_skill`. There is no search tool and no cap on titles. If no title fits, the agent says it does not have that information and hands over to a human. An entry is a title and its details, written in English or Bangla, edited in `/admin/#/skills`. Titles are unique ignoring case. Write them clearly, for example "Root canal treatment cost", because the title is all the model sees before it fetches.

### Turn-taking, silence and limits

- **Turn-taking:** server-side semantic VAD at low eagerness. The caller can interrupt the agent.
- **Scripted lines:** the greeting, the "are you on the line?" nudge and the closing are spoken with a `response.create` that carries its own instruction ("Say exactly the following…"). A response-level instruction replaces the session prompt for that one reply, so the exact words are inside it. This keeps the greeting and closing word for word what staff wrote.
- **Silence** (`public/website/js/idle.js`, pure and tested): the clock starts when the caller stops speaking or the agent finishes a normal turn, and it never runs while the caller is speaking, so a long phone number is not silence. After **25 s** the agent asks "হ্যালো, আপনি কি লাইনে আছেন?" once. After **50 s** it speaks the closing and the call ends with reason `idle`.
- **Time limit:** 300 s. At the limit the agent is interrupted, speaks the closing and the call ends with reason `timeout`. A hard stop follows 10 s later if the audio stuck.
- **Ending:** on `end_call` the browser waits for the model's reply to finish, sends the tool result, speaks the scripted closing, waits for its audio to stop, then tears down. A 20 s fallback timer catches a stuck call.
- **Page closed mid-call:** `sendBeacon` posts the transcript so far.

### Transcript and call status

- `TranscriptBuilder` keeps ordered, speaker-labelled turns (`patient` or `agent`) with timestamps. The patient turn is the committed Scribe transcript, the agent turn is the text that was actually spoken, cut at a barge-in.
- `POST /api/calls/:id/finish` stores up to 500 turns of up to 2000 characters, fixes the end time and duration, and derives the status. It is **idempotent**: a second finish returns the call unchanged.
- Status rule (`calls/call.js`, `deriveCallStatus`):

| Condition, first match wins | Status |
|---|---|
| call errored and the patient never spoke | `failed` |
| outcome `booked` / `rescheduled` / `cancelled` | `booked` / `rescheduled` / `cancelled` |
| outcome `callback_needed` or intent `callback` | `follow_up_needed` |
| patient spoke fewer than 2 turns | `incomplete` |
| otherwise | `enquiry` |

Outcomes are written by the use cases as they happen, not inferred from the transcript, so the status is right even if the browser never delivers the transcript. Outcomes merge by rank so a later callback cannot overwrite a booking.

### Human handoff

The agent hands over when the caller asks for a person, has an emergency or a complaint, asks something the tools cannot answer, or when a tool fails. It collects name, phone (saved and read back as above) and a short reason, and calls `request_human_callback` with `urgent: true` for pain emergencies, swelling, bleeding, an accident or an upset caller. It tells the caller a callback is recorded only after the tool says ok. If the tool fails it gives the clinic number instead. Staff see open callbacks, urgent first, in `/admin/#/callbacks` with a badge in the menu, and mark them done.

### Safety

No diagnosis, medicine or dosage. Severe swelling, heavy bleeding, trouble breathing or an accident gets an emergency-department instruction and an urgent callback. The agent stays on dental topics. These rules are in the locked prompt layer and the closing line tells the model they win over the persona text.

### What happens when things fail

| Failure | Behaviour |
|---|---|
| Mic denied, no mic, unsupported browser | message and retry before any call row exists |
| Rate limited (429) | "try again later" message |
| OpenAI key minting fails | call marked `failed`, retry panel |
| Connection drops mid-call | transcript so far is saved, status from what was captured |
| A tool fails or times out | result `tool_unavailable`, the agent offers a human callback |
| Slot taken between check and book | `slot_unavailable` with `alternatives`, also guaranteed by a unique index |
| Invalid phone, date or time | coded error with guidance, the agent asks again |
| Caller silent | nudge, then a closing after 50 s |

## Data model

Cloudflare D1 (SQLite), created in the APAC region. The Worker is the only thing that reads or writes it. Contract: [contracts/data-model.md](agentic-hub/contracts/data-model.md).

```
patients 1 ──< appointments >── 1 doctors
    │ 1              │ ∗
    └──< calls >─────┘ (call_id)        calls 1 ── 1 call_extractions
          │ 1                           calls 1 ──< transcript_turns
          └──< callbacks                settings, skills (standalone)
```

| Table | Holds |
|---|---|
| `calls` | one row per call: `started_at`, `ended_at`, `duration_s`, `status`, `patient_id`, `ip_hash` |
| `call_extractions` | structured fields: `patient_name`, `phone`, `reason_for_visit`, `preferred_datetime`, `intent`, `outcome`, `notes` |
| `transcript_turns` | `call_id`, `idx`, `speaker`, `text_bn` (the text as spoken), `ts` |
| `patients` | `full_name`, `phone` (unique, normalised `01XXXXXXXXX`) |
| `appointments` | `patient_id`, `doctor_id`, `call_id`, `slot` (clinic-local `YYYY-MM-DDTHH:MM`), `status` |
| `callbacks` | `call_id`, `name`, `phone`, `reason`, `urgent`, `status` (`open`, `resolved`) |
| `doctors` | names (English and Bangla), specialty, working days (JSON), hours, `active` |
| `skills` | agent knowledge: `title`, `content`, `enabled` |
| `settings` | key/value: clinic profile (with Bangla twins) and the three editable agent texts |

**How data moves.** During the call the tools write the extraction, patient, appointment and callback as soon as each fact is learned, so nothing depends on the call ending cleanly. After the call the browser posts the transcript and the server derives the status. **No audio is recorded or stored.** Audio goes from the browser to OpenAI only. `text_en` and `calls.summary` exist but are not written, because there is no post-call analysis step.

**Migrations** are numbered files in `migrations/`, applied once and tracked by `wrangler d1 migrations apply`. They hold the schema, the demo clinic and knowledge, and later clean-ups. Principle: a migration cleans up what a removed feature leaves behind.

## Scheduling rules

All in `scheduling/` and covered by tests with a fixed clock (Saturday 2026-11-14 10:00, Asia/Dhaka).

- Slots are `slot_minutes` long (15, 20, 30, 45 or 60, default 30) inside a doctor's working days and hours.
- A slot must start at least 30 minutes from now and within 60 days.
- Dates and times are validated as real calendar values. Bangla digits are accepted everywhere.
- One active appointment per doctor and slot: checked in the use case and enforced by the unique index `uq_appt_active_slot`.
- Without a doctor name, any doctor free at that time is used. With one, the name is matched and an unknown name returns `doctor_not_found`. `check_availability` offers at most 8 slots and `slot_unavailable` returns up to 5 alternatives.
- Reschedule and cancel find the caller's upcoming appointment by phone. With several, they return `appointment_ambiguous` and the agent asks which date.
- Patients are registered by phone number: the same number is the same patient.

## HTTP API

Full contract: [contracts/http-api.md](agentic-hub/contracts/http-api.md). Errors are `{ error: { code, message, details? } }` with 400, 401, 404, 409, 429 or 500.

| Area | Routes |
|---|---|
| Website | `GET /` (rendered by the Worker with SEO tags) · `GET /api/public/site` (clinic profile and active doctors, no agent knowledge) |
| Voice call | `POST /api/session` · `POST /api/agent/tools/:name` · `POST /api/calls/:id/finish` |
| Admin auth | `POST /api/admin/login` · `POST /api/admin/logout` · `GET /api/admin/me` |
| Admin data | `GET /api/admin/dashboard` · `calls` · `calls/:id` · `appointments` (+ `PATCH :id`) · `patients` · `callbacks` (+ `PATCH :id/resolve`) |
| Admin config | `skills` (CRUD) · `doctors` (CRUD) · `agent` (get, put, `preview`) · `settings` (clinic profile) |

## Admin portal

`/admin`, a plain ES-module single-page app (`public/admin/js/`, one file per page). Pages: **Overview** (calls, outcomes, last 7 days) · **Calls** (search and filter, then a per-call view with extracted fields, transcript, appointment and callbacks) · **Appointments** · **Schedule** (one day, one column per doctor) · **Callbacks** · **Patients** · **Agent prompt** (edit persona, greeting, closing; **Show final prompt** previews the whole prompt for unsaved text; **Reset to default**) · **Agent knowledge** · **Doctors** · **Clinic profile** · **How the agent works** (a one-page engineering overview with the call diagram, the decision paths and the known gaps).

## Website

- **Bangla by default, complete in both languages.** English is one tap away and remembered, and `/?lang=en` or `/?lang=bn` wins over the saved choice. The static HTML is Bangla, so there is no flash of English. A test keeps the static Bangla text equal to the dictionary.
- **One style per language:** times `10:00 am` / `সকাল ১০:০০`, Bangla digits in the Bangla page, day ranges `Sat–Thu` / `শনি–বৃহ`, the phone as a `tel:` link.
- **Hero:** a Three.js 3D stage that cycles through four dental treatments (drag to spin), the main action **Book an appointment**, and a floating **Call Dentis** button. Both start the same live voice call. The call panel shows connecting, live (timer, mute, end; voice only, no text), ended and error states.
- **SEO and previews:** the Worker serves `/` itself and writes per-language title, description, canonical and `hreflang` links, Open Graph and Twitter tags and `Dentist` JSON-LD from the live clinic profile.
- **No third-party hosts at load.** Fonts and Three.js are served from this site.
- The Services section is fixed copy in `public/website/js/services.js`. Agent knowledge is never shown on the website.

## Security

- **Secrets** live only in Wrangler secrets (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ADMIN_ACCESS_KEY`) and a git-ignored `.dev.vars`. Nothing secret is in the repo, and a scan for key patterns is clean.
- **The browser never sees the OpenAI key.** It gets a client key that expires after 300 s.
- **Admin login:** one access key, compared in constant time. The session cookie is `<expiry>.<HMAC-SHA256>` and carries no user data, `HttpOnly`, `SameSite=Strict`, `Secure` on HTTPS, valid 12 hours.
- **CSRF:** writes also require the `X-Requested-With: dentis` header.
- **Input:** every tool argument and every admin field is validated again on the server, whatever the model or form sent.
- **Privacy:** only a hash of the caller's IP is stored. Test data only, no real patient data.

## Tests

`npm test` runs 456 tests with Node's built-in runner, no dependencies and no setup.

| Folder | What it proves |
|---|---|
| `test/scheduling`, `knowledge`, `clinic`, `calls`, `agent`, `shared` | rules and use cases: phone, slot, availability, status derivation, prompt contents, every tool on its success and failure paths, with in-memory ports |
| `test/stores` | the **real SQL and migrations**, run on a `node:sqlite` stand-in for D1 |
| `test/admin`, `test/website`, `test/api` | the HTTP API end to end: sessions, tools, finish, admin auth, CRUD, the SEO home page, HMAC |
| `test/frontend` | transcript building, sentence chunking, SSE, PCM playback, Scribe messages, the silence clock, copy completeness in both languages, and every admin page drawn against the real in-memory API |
| `test/architecture.test.js` | each part imports only what it may |

A bug fix starts with a failing test.

## Run locally and deploy

```bash
npm install
cp .dev.vars.example .dev.vars     # put in OPENAI_API_KEY, ELEVENLABS_API_KEY and an ADMIN_ACCESS_KEY
npm run db:init:local              # apply migrations: schema, demo clinic, knowledge
npm run db:samples:local           # optional: invented sample calls
npm run dev                        # http://localhost:8787   (admin: /admin)
npm test
```

To run without real keys: `npx wrangler dev --var OPENAI_API_KEY:x --var ADMIN_ACCESS_KEY:local-test-key` (a call then answers "not configured" for the missing ElevenLabs key) (command-line vars win over `.dev.vars`, and a fake key avoids real OpenAI calls).

```bash
npx wrangler d1 create dentis          # copy the database_id into wrangler.jsonc
npm run db:init:remote                 # applies pending migrations once
npm run db:samples:remote              # optional sample calls
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put ADMIN_ACCESS_KEY
npm run deploy
```

Add a Cloudflare rate-limiting rule on `POST /api/admin/login` in production. The OpenAI and ElevenLabs accounts need credit for calls to work.

## Design decisions and trade-offs

- **Speech in direct from the browser, speech out through the Worker.** The mic goes straight to Scribe over a one-use token (lowest latency, no audio proxy for input). The voice goes through the Worker so the ElevenLabs key stays secret. The chat history is held by the browser and sent each turn, so the Worker stays stateless. The Worker rejects `system` messages, so the history cannot change the rules, but the caller can edit it. Tool calls are authorised only by the call id (see limits).
- **A separate speech-to-text, LLM and text-to-speech chain, not one realtime model.** The owner asked for ElevenLabs voices and a GPT mini brain with tools. Each part is swappable and the exact wording is under our control. The cost is more latency than a single realtime model and barge-in we build ourselves. Latency is cut by streaming at every step: the first sentence is spoken while the rest is still being written.
- **Facts through tools, behaviour through the prompt.** Anything that must be right (slots, bookings, phone numbers, the call status) is code that returns a result. The prompt only shapes tone and flow. The model is told the code's answer is the truth.
- **Titles in the prompt, details by tool, no search.** The model is better at choosing from a short title list than a keyword search is at guessing, and there is nothing to tune. If the list ever gets very long, the prompt gets longer with it.
- **Outcomes recorded as they happen.** The call status does not depend on parsing the transcript or on the browser delivering it.
- **No recording, no post-call AI analysis.** Less to store, less to get wrong, and no recordings to protect. The transcript and the structured fields are the record.
- **D1 and vanilla JS.** One deployable unit, nothing to build, easy to read in review. A framework would add moving parts the task does not need.
- **Grouped by part of the app, with dependency rules in a test.** A change to one area stays in one folder, and a bad import fails the build.

## Known limits

- **Nothing here has been run against the live OpenAI or ElevenLabs APIs.** The code follows their current docs and is tested against fakes. The first real call may need small fixes (model names, the `eleven_v4_turbo` dialogue endpoint, the default voice's Bangla accent).
- **Bangla quality is judged by ear, not measured.** The Bangla copy has not been reviewed by a native speaker. Accent and number recognition depend on the model, so read-back is the safety net.
- **Tool calls are authorised only by the call id.** Signing them to the session is the next hardening step. The transcript is built in the browser, so the server cannot verify it.
- **Staying on topic and refusing medical advice come from the prompt,** so they are not guaranteed. Latency and cost of the mini model are not measured.
- **One shared admin key,** no per-user audit, and no login rate limit in code (set one in Cloudflare).
- **The transcript has no English translation** and there is no post-call summary.
- **The page body is rendered in the browser.** Crawlers get the right metadata per language but see Bangla body text even for `?lang=en`.
- **Fees, phone and address are demo data** and any sample calls are invented. No real patient data is used.
- **Out of scope:** phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments. See [decisions](agentic-hub/decisions.md).

## 3-minute video outline

1. Landing page, flip through the treatments in the hero, switch to Bangla (20 s).
2. Press **Book an appointment**, book by voice mixing in English words, hear the phone number read back (90 s).
3. Open `/admin`, log in, show the call, transcript, captured fields and the appointment (45 s).
4. Edit an entry's fee in **Agent knowledge**, call again and ask for the price (25 s).
