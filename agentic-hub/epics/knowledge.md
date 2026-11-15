# Epic: Knowledge and agent prompt (planned)

Status: **in progress** (task `dynamic-agent-knowledge`). The approach is decided in [decisions](../decisions.md).

## Goal
Staff change how the agent speaks, and keep the clinic's details and FAQs up to date, without a deploy. The agent answers only from this knowledge.

## Needs
- **Editable agent instructions** in admin: persona and tone, greeting, extra rules. The booking flow, tool rules, truthfulness and safety rules stay in code and are always appended after the editable text. Admin can preview the final prompt and reset to the default.
- **Clinic details:** the existing clinic profile. Extra facts (parking, payment methods, emergency advice) are FAQ entries, not new columns.
- **FAQ knowledge base:** skills get a `kind` (`service`, `faq`, `policy`) for the agent only. The website's Services section is fixed copy in `public/js/services.js`, not read from the database.
- **Retrieval by the model first:** only skill titles go in the prompt, up to a cap (proposed 40), so the agent can fetch one by exact title (`get_skill`). `lookup_skill` stays as the search fallback and the only path past the cap. Admin shows "N of 40 titles in the agent's index".
- **Later, only if needed:** Cloudflare AI Search behind a `KnowledgeSearch` port (see the open item in decisions).

## Acceptance
- [ ] Editing the instructions changes the next call. The safety and booking rules cannot be edited away.
- [ ] An FAQ added in admin is answered correctly on the next call, in Bangla and English.
- [ ] FAQs do not appear in the website Services section.

## Open questions
See "Knowledge approach" in [decisions](../decisions.md).
