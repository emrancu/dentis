# Dentis: a Bangla voice receptionist for a dental centre

A dental centre website: the hero's main action is **Book an appointment** (booked by voice in Bangla), with a Three.js 3D stage on the right that cycles through four dental treatments (drag to spin) and a floating **Call Dentis** button at the bottom right. A staff portal lives at `/admin`. Built for the StrategyByte AI Engineer task brief (`StrategyByte_AI_Engineer_Task_Brief_14Nov.pdf`).

- **Voice:** OpenAI Realtime API over WebRTC, straight from the browser. The Worker only mints a short-lived key.
- **Backend:** one Cloudflare Worker (vanilla JS), D1 for data, R2 for recordings. No framework, no build step, no runtime dependencies.
- **Admin:** access-key login. Staff manage the agent's knowledge ("skills"), doctors and the clinic profile, and read every call.
- **Code:** domain-driven layers, tested. Rules, decisions and contracts live in [`agentic-hub/`](agentic-hub/README.md). Agents read [`CLAUDE.md`](CLAUDE.md).

## The website: Bangla first, complete in both languages

- **Bangla is the default.** English is one tap away, remembered, and a link can carry it: `/?lang=en` or `/?lang=bn` wins over the saved choice. The static HTML is Bangla, so there is no flash of English.
- **Nothing mixes languages.** Every display field has a Bangla twin (skill title and description, doctor specialty, clinic address, hours, directions, prep notes). English fields hold English only, Bangla fields Bangla only. The site shows the visitor's language and falls back to the other only when a field is empty. Admin marks services that have no Bangla text.
- **One style per language.** Times are 12-hour: `10:00 am` in English and `সকাল ১০:০০` in Bangla, with Bangla digits. Working days read `Sat–Thu` / `শনি–বৃহ`. The phone number is a tappable `tel:` link.
- **Names are consistent.** The navigation label is the section label, every booking button says the same, and the hero treatment cards use exactly the Services names (a test enforces it).
- **The floating button is "Talk to us" / "কথা বলুন"**: a voice call in the browser. The clinic's phone number is a separate link.
- **No third-party hosts.** Fonts (Inter, Fraunces, Hind Siliguri, Noto Serif Bengali) and Three.js are served from `public/fonts` and `public/vendor`.
- **Link previews and search.** The Worker serves `/` itself and adds the per-language title and description, canonical and `hreflang` links, Open Graph and Twitter tags, and `Dentist` JSON-LD built from the live clinic profile. `public/og.png` is the preview image.

## Admin: the agent's prompt and knowledge

Everything the agent says and knows is edited in `/admin`, with no deploy. The next call uses it.

- **Agent prompt:** edit the persona and tone (`Instructions`) and the `Greeting`. Write `{clinic}` where the clinic name goes. **Show final prompt** previews the whole prompt for unsaved text, and **Reset to default** restores the built-in text. The booking steps, tool rules, "facts only from tools" and safety rules are **locked in code**. They always come after your text and win over it, so they cannot be edited away.
- **Agent knowledge:** each entry has a type (**Service**, **FAQ** or **Policy**), a title, a description, the details the agent will say, and keywords (other words callers use, in Bangla and English). Only **services** show on the website.
- **How the agent finds an entry:** it is shown the titles of enabled entries (never the details), up to 40. It fetches one by exact title with `get_skill`, or searches with `lookup_skill` by the caller's own words. Past 40 entries the list is left out and the agent only searches. The page shows "N of 40 titles in the agent's index".
- **Retrieval is tested:** `test/application/retrieval-eval.test.js` runs 32 Bangla and English phrasings through the real seed and ranking. The expected entry must be in the top 3 for at least 90 percent (today 32 of 32; 29 of 32 are first).

## How a call works

```
Browser ──POST /api/session {intent}──▶ StartCall: new call row, prompt built from clinic + doctors + skill titles,
   │                                  short-lived OpenAI key returned
   ├─ WebRTC audio + data channel ──▶ OpenAI Realtime (gpt-realtime, Bangla)
   ├─ model function call ──POST /api/agent/tools/:name──▶ ToolExecutor ─▶ use cases ─▶ D1
   ├─ hang up ──POST /api/calls/:id/finish──▶ transcript saved, status derived ─▶ background analysis
   └─ PUT /api/calls/:id/recording ─▶ R2
```

**Agent tools** (see [contract](agentic-hub/contracts/agent-tools.md)): `get_clinic_info`, `list_doctors`, `list_skills`, `get_skill`, `lookup_skill`, `check_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `save_patient_details`, `request_human_callback`, `get_current_datetime`, `end_call`. Facts such as fees, hours and slots come only from these tools. Editing a skill in `/admin` changes the next call, with no deploy.

**Data model** ([contract](agentic-hub/contracts/data-model.md)): `calls`, `call_extractions`, `transcript_turns`, `patients`, `appointments`, `callbacks`, `skills`, `doctors`, `settings`. Validation lives in the domain: Bangladeshi mobile numbers (Bangla digits and `+880` accepted), real future dates within 60 days, doctor hours, one active booking per doctor and slot (also a unique index). After a call a small model adds an English summary and translation and fills gaps in the extraction. It never overrides what the tools captured.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars        # put your OPENAI_API_KEY and an ADMIN_ACCESS_KEY in it
npm run db:init:local                 # apply migrations (tracked): schema + Dentis demo clinic + knowledge
npm run db:samples:local              # optional: 4 invented sample calls from seed/
npm run dev                           # http://localhost:8787  (admin: /admin)
npm test                              # 400 tests, no setup needed
```

## Deploy

```bash
npx wrangler d1 create dentis         # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create dentis-recordings
npm run db:init:remote                # applies pending migrations once
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
public/              landing page (Three.js hero) and /admin SPA, plain ES modules; fonts/ and vendor/ are self-hosted
migrations/          numbered, tracked migrations (schema, demo clinic, skill kinds, knowledge, Bangla twin fields)
seed/                optional sample calls, not a migration
test/                mirrors src/, plus frontend and architecture tests
agentic-hub/         requirements, principles, epics, contracts, task commands
```

## Tests

`npm test` runs 400 tests with Node's built-in runner:

| Folder | What it proves |
|---|---|
| `test/domain` | phone, slot, availability, call status, skill ranking (keywords, Bangla word endings), agent prompt rules |
| `test/application` | every use case and every agent tool (success and failure paths) with in-memory ports |
| `test/infrastructure` | the **real SQL and migrations** (via a `node:sqlite` stand-in for D1), OpenAI request shapes, HMAC |
| `test/application/retrieval-eval.test.js` | Bangla and English questions find the right knowledge entry (top 3 for at least 90 percent) |
| `test/interface` | the whole HTTP API end to end: sessions, tools, finish, recording, admin auth, CRUD |
| `test/frontend` | transcript building from Realtime events, copy completeness in both languages, formatters |
| `test/architecture.test.js` | layers only import inward (fails on a bad import) |

## What is not done, honestly

- **The Bangla copy has not been read by a native speaker.** I wrote it, checked it for consistency, and tests keep both languages in step, but wording such as "অ্যাপয়েন্টমেন্ট" (many patients say "সিরিয়াল") needs a person's judgement.
- **Search engines get the right metadata per language, but the page body is rendered in the browser.** A crawler sees Bangla body text even for `?lang=en`. Separate server-rendered `/en` pages are out of scope. Opening hours are free text, so the JSON-LD carries them as text and not as structured days and times.
- The hero's small treatment pills are 32px tall with an invisible 44px touch area, to keep them compact.
- The `social image` is a fixed picture. It does not change when the clinic profile does.


- **A live voice call was not run end to end.** This build environment had no OpenAI key or microphone. Everything around the call is tested: session creation, tool execution, transcript handling, status derivation, the call panel states. The Realtime endpoint shapes (`/v1/realtime/client_secrets`, `/v1/realtime/calls`, GA event names) follow OpenAI's docs as I know them. **Make one real call first** and watch the browser console if anything differs.
- **Bangla quality is not measured.** The prompt asks for colloquial Dhaka Bangla, code-switching, digit read-back and safe behaviour. Accent and number recognition depend on the model. Read-back confirmation and the post-call analysis are the safety nets.
- **Not deployed.** I had no Cloudflare account access. The steps above are tested only against `wrangler dev` with local D1.
- **Sample calls are invented** (`seed/sample_calls.sql`). Replace them with your own test calls before submitting.
- Single shared access key, no per-user audit, no login rate limit in code.
- Out of scope: phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments. See [decisions](agentic-hub/decisions.md).

## 3-minute video outline

1. Landing page, flip through the treatments in the hero, switch to Bangla (20 s).
2. Press **Book an appointment**, book an appointment by voice, mixing in English words, read the phone number back (90 s).
3. Open `/admin`, log in, show the call, transcript with English translation, captured fields, the appointment and the recording (45 s).
4. Edit a skill's fee in **Agent skills**, call again and ask for the price (25 s).
