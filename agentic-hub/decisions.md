# Decisions

**Decided** items were chosen by the project owner. **Assumed** items are working defaults to confirm. **Out of scope** items are not planned, so no code for them.

## Decided
| Topic | Decision |
|---|---|
| Brand | Dentis, a dental centre in Dhaka, with its own SVG logo. |
| Stack | Cloudflare Workers with vanilla JS (no framework, no front-end build), D1. Three.js only for the hero. |
| Code style | Domain-driven layers, YAGNI, tests under `test/` (see principles). |
| Admin | At `/admin`, login with one access key. |
| Voice | **OpenAI Realtime API** over WebRTC from the browser. The Worker mints a short-lived client secret, so the API key stays on the server. |
| Agent knowledge | Skills (title, description, details) managed in admin and read by the agent through tools. |
| Site focus | A dental centre website first. The main action is **Book an appointment** (voice booking in Bangla). A floating **Call Dentis** button sits at the bottom right. The hero shows a round 3D stage on the right that cycles through four dental treatments. |
| Agent prompt | Admin edits the persona, tone and language text the greeting and the closing line. Booking flow, tool rules, truthfulness and safety stay in code and are appended after the editable text, with a closing line that says they win. Admin gets a preview of the final prompt and a reset to default. No version history. |
| Knowledge base | Skills with a `kind` (`service`, `faq`, `policy`), no keywords: the model picks by title and description. Only the titles of enabled skills go in the prompt, never the details, up to a cap of 40 (a constant in code, unmeasured). The agent fetches details with `get_skill` by exact title, and `lookup_skill` is the fallback and the only path past the cap. Titles should be English with a short Bangla hint, because Bangla costs more tokens. Admin shows "N of 40 titles in the agent's index". |
| Website content | The Services section shows `service` entries only. FAQs are not on the website yet. |
| Migrations | Numbered files in `migrations/`, applied once and tracked by `wrangler d1 migrations apply`. Demo seeds are also safe to run twice. Optional sample calls live in `seed/`. |
| Default language | **Bangla.** English is one tap away and remembered. `?lang=` in the link wins over the saved choice. The static HTML is Bangla so there is no flash of English. |
| Bilingual content | Each display field has a Bangla twin (see the data model). Fields never mix languages. The exception is Agent knowledge (`skills`): it is for the agent only, so it has no Bangla twins and staff write it in English or Bangla. |
| Display formats | Times 12-hour (`10:00 am`, `সকাল ১০:০০`), Bangla digits in the Bangla page, day ranges (`Sat–Thu`), phone as a `tel:` link. |
| Voice button naming | The floating button is "Talk to us" / "কথা বলুন". It is a voice call in the browser, not a phone call. The clinic's phone number is a separate `tel:` link. |
| Typography | Bangla root size is 8% larger, headings use a Bangla serif, small labels are heavier. |
| Self-hosting | Fonts and Three.js are served from this site. |
| SEO | The Worker serves `/` and writes the per-language title, description, canonical and `hreflang` links, Open Graph and Twitter tags and `Dentist` JSON-LD into the HTML, from the live clinic profile. The body is still rendered in the browser, so a crawler sees Bangla body text even for `?lang=en`. Separate server-rendered `/en` pages are out of scope. |
| Footer | The public footer does not link to the staff portal. The "demo clinic with sample data" line stays while this is a demo and is one dictionary key to remove at launch. |
| Two call entry points | `Book an appointment` starts a call with intent `booking` (the agent goes straight to booking). `Call Dentis` starts intent `general`. Both use the same voice agent. |

| Hero art | A light hero with a **round stage** on the right (below the text on phones). A **Three.js** 3D model (pinned CDN version, no build step) cycles through four treatments: check-up, whitening, braces, implant. Floating cards name the current treatment; tabs or a tap on the model switch it, and it auto-advances every 5 s unless hovered. Drag spins the model. A small static tooth drawing is the fallback when WebGL is missing. Replaces the line-drawn person with a toothache, at the owner's request. |

## Assumed
| Topic | Default |
|---|---|
| Voice settings | Model `gpt-realtime-mini` (the low-cost model; switch to `gpt-realtime` for higher quality), voice `marin`, caller transcription `gpt-4o-mini-transcribe` with language `bn`, semantic VAD. |
| Post-call analysis | **Removed.** The tools already capture structured data (name, phone, reason, time, outcome), so no summary, translation or gap-filling call is made. The transcript is stored in Bangla only. |
| Clinic week | Doctors work Saturday to Thursday by default. Friday is off. Each doctor has their own days and hours. |
| Booking | Slot length 30 minutes (setting), at least 30 minutes ahead, at most 60 days ahead. |
| Abuse guard | 10 sessions per IP per hour, calls end at 5 minutes. |
| Copy | No unmeasured claims (principle 15). The hero highlights the care, not a booking time. |
| Recording | **Removed.** No audio is stored and there is no R2 bucket. Only the transcript is kept, and the call panel says so. Bring recording back only if the clinic needs audio for disputes or training. |
| Admin session | HMAC-signed HttpOnly cookie, 12 hours. |

## Open: Cloudflare AI Search later
Skills are the knowledge base now (see Decided). Cloudflare AI Search is **deferred**. Add it behind a `KnowledgeSearch` port when there are more than about 40 entries, long documents (PDF price lists), or the retrieval eval misses its target. Known from the docs: `search()` is retrieval only (no LLM), hybrid by default, usable from a Workers binding, built-in storage is "indexed immediately". Not stated in the docs: Bangla support of its embedding and reranker models, how one item is updated, latency, pricing. Measure these first. Beware that an index can lag behind an admin edit, which would break "the next call uses the edit".

## Out of scope
Phone (PSTN) calls, outbound calls, calendar sync, several clinics, payments, per-user admin accounts, rate limiting of the login (use a Cloudflare rule in production).
