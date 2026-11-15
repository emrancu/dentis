# Principles

1. **Contract first.** Write the endpoint, tool or table shape in `contracts/` before the code. Code follows the contract, and a contract changes in the same change as the code.
2. **Code is grouped by part of the app** in `src/`. A folder holds everything for one part: its rules, its use cases and its database code.
   - `scheduling/`, `knowledge/`, `clinic/`, `calls/`, `agent/`: the business areas. Entities, value objects and rules; use cases (one class per intent, `execute(input)`); and `store.js`, the D1 code for that area. They may use `shared/` and each other.
   - `admin/`: the staff portal API. Routes are split by area in `admin/routes/`. The login guard and session cookie are here.
   - `website/`: the public site. `site-routes.js` for the page data, `call-routes.js` for the voice call (session, agent tools, finish), `home.js` for the SEO page.
   - `shared/`: errors, time, the router and response helpers. Imports nothing else.
   - `admin/` and `website/` never import each other. Only `index.js` imports the outside adapters (`store.js` files, `agent/realtime-gateway.js`, `admin/security.js`). `composition.js` wires them to the use cases, `app.js` builds the HTTP app, `index.js` is the Worker entry.
   A test (`test/architecture.test.js`) fails on a bad import.
3. **Rules live with their business area.** Phone, date and time validation, slot rules, status rules and skill ranking are code in `scheduling/`, `knowledge/` and so on. Never in routes, SQL or the front end.
4. **Typed errors.** Throw `DomainError` subclasses with a stable `code`. Adapters map them to an HTTP status or an agent tool result. Never match on messages.
5. **YAGNI.** Build only what the current task and its contract need. No speculative options, abstractions, tables, settings or layers. An open choice stays a line in `decisions.md`, not code. Add an abstraction when a second real use appears.
6. **Tests ship with code.** Every domain rule, use case, adapter and route has a test in `test/`, mirroring `src/` (one test folder per part). Runner: `node:test`, no dependencies. Use cases run on in-memory ports and a fixed clock (Sat 2026-11-14 10:00, Asia/Dhaka). A bug fix starts with a failing test.
7. **The agent tells the truth.** Fees, hours, doctors and slots come from tools, never from the model's memory. Unknown means: say so and offer a human callback.
8. **The agent is safe.** No diagnosis, medicine or treatment advice. Severe symptoms get urgent-care advice and a callback.
9. **Confirm before commit.** Read back name, phone (the `phone_spoken` text), date and time before a booking. Tools are safe to repeat: the same booking twice must not double-book.
10. **Secrets** only in Worker secrets or `.dev.vars` (git-ignored). Test or fake patient data only.
11. **Design** like a senior UX designer. One clear action per screen, every state designed (idle, loading, empty, error), responsive from 360px, WCAG AA, keyboard focus, `prefers-reduced-motion` respected.
12. **Small and plain.** Files stay short and readable. Comments explain why. No dead code.
13. **Docs style:** short, plain sentences.
14. **The site is a dental centre first.** Copy speaks as a clinic, not as an AI product. The headline and sub-copy are about dental care. Booking lives in the buttons, not in the headline. The voice agent is how booking happens, not the message.
15. **No claims we have not measured.** No speed promises ("in a minute"), counts or guarantees in copy unless they are true and checked. Highlight what the patient gets (care, an easy appointment), not how fast our tech is.
16. **Seeds do not duplicate.** Schema and demo data are numbered migrations, applied once and tracked by `wrangler d1 migrations apply`. The optional sample calls (`seed/sample_calls.sql`) are safe to run twice, and a test proves it. A migration cleans up what a removed feature leaves behind.
17. **Both languages are complete.** Every visible string and every piece of clinic content exists in Bangla and in English. Bangla is the default. A single string never mixes the two languages, and a test keeps the static Bangla text equal to the dictionary.
18. **One style per language** for times, digits, day lists and labels. The same thing has the same name everywhere: the navigation label, the section label and the button say the same.
19. **No third-party hosts at page load.** Fonts and Three.js are served from this site.
