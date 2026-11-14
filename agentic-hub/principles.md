# Principles

1. **Contract first.** Write the endpoint, tool or table shape in `contracts/` before the code. Code follows the contract, and a contract changes in the same change as the code.
2. **Domain-driven layers** in `src/`, dependencies point inward only:
   - `domain/`: entities, value objects, domain services, typed errors. Imports nothing from other layers.
   - `application/`: use cases (one class per intent, `execute(input)`), ports (the repository and gateway shapes it needs), the agent prompt and tools.
   - `infrastructure/`: D1, R2, OpenAI and crypto adapters that implement the ports.
   - `interface/`: HTTP router and handlers. Thin: parse, call a use case, map the result.
   - `composition.js` wires adapters into use cases. `index.js` is the Worker entry.
   A test (`test/architecture.test.js`) fails if a layer imports an outer layer.
3. **Rules live in the domain.** Phone, date and time validation, slot rules, status rules and skill ranking are domain code. Never in routes, SQL or the front end.
4. **Typed errors.** Throw `DomainError` subclasses with a stable `code`. Adapters map them to an HTTP status or an agent tool result. Never match on messages.
5. **YAGNI.** Build only what the current task and its contract need. No speculative options, abstractions, tables, settings or layers. An open choice stays a line in `decisions.md`, not code. Add an abstraction when a second real use appears.
6. **Tests ship with code.** Every domain rule, use case, adapter and route has a test in `test/`, mirroring `src/`. Runner: `node:test`, no dependencies. Use cases run on in-memory ports and a fixed clock (Sat 2026-11-14 10:00, Asia/Dhaka). A bug fix starts with a failing test.
7. **The agent tells the truth.** Fees, hours, doctors and slots come from tools, never from the model's memory. Unknown means: say so and offer a human callback.
8. **The agent is safe.** No diagnosis, medicine or treatment advice. Severe symptoms get urgent-care advice and a callback.
9. **Confirm before commit.** Read back name, phone (digit by digit), date and time before a booking. Tools are safe to repeat: the same booking twice must not double-book.
10. **Secrets** only in Worker secrets or `.dev.vars` (git-ignored). Test or fake patient data only.
11. **Design** like a senior UX designer. One clear action per screen, every state designed (idle, loading, empty, error), responsive from 360px, WCAG AA, keyboard focus, `prefers-reduced-motion` respected.
12. **Small and plain.** Files stay short and readable. Comments explain why. No dead code.
13. **Docs style:** short, plain sentences.
14. **The site is a dental centre first.** Copy speaks as a clinic, not as an AI product. The headline and sub-copy are about dental care. Booking lives in the buttons, not in the headline. The voice agent is how booking happens, not the message.
15. **No claims we have not measured.** No speed promises ("in a minute"), counts or guarantees in copy unless they are true and checked. Highlight what the patient gets (care, an easy appointment), not how fast our tech is.
16. **Seeds are safe to run twice.** Demo data must not duplicate on a second run, and a test proves it. Schema changes are numbered migrations, applied once and tracked by `wrangler d1 migrations apply`.
