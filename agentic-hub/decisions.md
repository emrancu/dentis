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
| Site focus | A dental centre website first. The main action is **Book an appointment** (voice booking in Bangla). A floating **Call Dentis** button sits at the bottom right. The hero shows a line-drawn person with a toothache on the right. On hover they smile. |
| Two call entry points | `Book an appointment` starts a call with intent `booking` (the agent goes straight to booking). `Call Dentis` starts intent `general`. Both use the same voice agent. |

| Hero art | A line-drawn **person with a toothache** on the right of the hero, rendered as 3D line art with **Three.js** (pinned CDN version, no build step). The face morphs smoothly to a smile on hover, tap or during a call. The inline SVG in the page is the single source of the drawing and the fallback when WebGL is missing. The earlier 3D tooth was removed because it did not look right. |

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

## Open: knowledge approach (proposal, needs your answer)
| Topic | Proposal |
|---|---|
| Editable prompt | One editable instructions field plus a greeting, stored in `settings`. Booking flow, tool rules, truthfulness and safety stay in code and are appended last. Admin gets preview and reset. |
| FAQ storage | Reuse skills with a `kind` field and optional `keywords`. No new table. |
| Retrieval | Skills first. Only **titles** go in the prompt (never the details), up to a cap of about 40 entries (unmeasured, to be tuned). The agent fetches details with `get_skill` by exact title, and `lookup_skill` stays as the fallback and as the only path past the cap. Titles should be English with a short Bangla hint, because Bangla costs more tokens. Admin shows a counter of entries and estimated tokens. Reason: strongly consistent (an admin edit is live on the next call), no extra latency hop, exact fees. |
| Cloudflare AI Search | Not now. Add behind a `KnowledgeSearch` port when there are more than about 50 entries, long documents (PDF price lists), or the retrieval eval misses its target. Known from the docs: `search()` is retrieval only (no LLM), hybrid by default, Workers binding, built-in storage is "indexed immediately". Not stated in the docs: Bangla support of the embedding or reranker models, update semantics for one item, latency, pricing. These must be measured before adopting. |
| Questions for the owner | Keep safety and booking rules non-editable? Show FAQs on the website? Defer AI Search until the eval says so? |

## Out of scope
Phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments, per-user admin accounts, rate limiting of the login (use a Cloudflare rule in production).
