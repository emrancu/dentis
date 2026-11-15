# Decisions

**Decided** items were chosen by the project owner. **Assumed** items are working defaults to confirm. **Out of scope** items are not planned, so no code for them.

## Decided
| Topic | Decision |
|---|---|
| Brand | Dentis, a dental centre in Dhaka, with its own SVG logo. |
| Stack | Cloudflare Workers with vanilla JS (no framework, no front-end build), D1, R2. Three.js only for the hero. |
| Code style | Domain-driven layers, YAGNI, tests under `test/` (see principles). |
| Admin | At `/admin`, login with one access key. |
| Voice | **OpenAI Realtime API** over WebRTC from the browser. The Worker mints a short-lived client secret, so the API key stays on the server. |
| Agent knowledge | Skills (title, description, details) managed in admin and read by the agent through tools. |
| Site focus | A dental centre website first. The main action is **Book an appointment** (voice booking in Bangla). A floating **Call Dentis** button sits at the bottom right. The hero shows a round 3D stage on the right that cycles through four dental treatments. |
| Agent prompt | Admin edits the persona, tone and language text and the greeting. Booking flow, tool rules, truthfulness and safety stay in code and are appended after the editable text, with a closing line that says they win. Admin gets a preview of the final prompt and a reset to default. No version history. |
| Knowledge base | Skills with a `kind` (`service`, `faq`, `policy`) and `keywords`. Only the titles of enabled skills go in the prompt, never the details, up to a cap of 40 (a constant in code, unmeasured). The agent fetches details with `get_skill` by exact title, and `lookup_skill` is the fallback and the only path past the cap. Titles should be English with a short Bangla hint, because Bangla costs more tokens. Admin shows "N of 40 titles in the agent's index". |
| Website content | The Services section shows `service` entries only. FAQs are not on the website yet. |
| Migrations | Numbered files in `migrations/`, applied once and tracked by `wrangler d1 migrations apply`. Demo seeds are also safe to run twice. Optional sample calls live in `seed/`. |
| Two call entry points | `Book an appointment` starts a call with intent `booking` (the agent goes straight to booking). `Call Dentis` starts intent `general`. Both use the same voice agent. |

| Hero art | A light hero with a **round stage** on the right (below the text on phones). A **Three.js** 3D model (pinned CDN version, no build step) cycles through four treatments: check-up, whitening, braces, implant. Floating cards name the current treatment; tabs or a tap on the model switch it, and it auto-advances every 5 s unless hovered. Drag spins the model. A small static tooth drawing is the fallback when WebGL is missing. Replaces the line-drawn person with a toothache, at the owner's request. |

## Assumed
| Topic | Default |
|---|---|
| Voice settings | Model `gpt-realtime`, voice `marin`, caller transcription `gpt-4o-transcribe` with language `bn`, semantic VAD. |
| Post-call analysis | A small chat model writes an English summary, an English translation of each turn, and fills gaps in the extraction. It never overrides data the tools captured. |
| Clinic week | Doctors work Saturday to Thursday by default. Friday is off. Each doctor has their own days and hours. |
| Booking | Slot length 30 minutes (setting), at least 30 minutes ahead, at most 60 days ahead. |
| Abuse guard | 10 sessions per IP per hour, calls end at 5 minutes. |
| Copy | No unmeasured claims (principle 15). The hero highlights the care, not a booking time. |
| Recording | The browser records the call and uploads it to R2. A consent notice is shown. |
| Admin session | HMAC-signed HttpOnly cookie, 12 hours. |

## Open: Cloudflare AI Search later
Skills are the knowledge base now (see Decided). Cloudflare AI Search is **deferred**. Add it behind a `KnowledgeSearch` port when there are more than about 40 entries, long documents (PDF price lists), or the retrieval eval misses its target. Known from the docs: `search()` is retrieval only (no LLM), hybrid by default, usable from a Workers binding, built-in storage is "indexed immediately". Not stated in the docs: Bangla support of its embedding and reranker models, how one item is updated, latency, pricing. Measure these first. Beware that an index can lag behind an admin edit, which would break "the next call uses the edit".

## Out of scope
Phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments, per-user admin accounts, rate limiting of the login (use a Cloudflare rule in production).
