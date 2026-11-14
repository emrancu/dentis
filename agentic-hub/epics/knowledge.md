# Epic: Knowledge and agent prompt (planned)

Status: **proposal, not approved.** The approach is an open item in [decisions](../decisions.md). Nothing here is built.

## Goal
Staff change how the agent speaks, and keep the clinic's details and FAQs up to date, without a deploy. The agent answers only from this knowledge.

## Needs
- **Editable agent instructions** in admin: persona and tone, greeting, extra rules. The booking flow, tool rules, truthfulness and safety rules stay in code and are always appended after the editable text. Admin can preview the final prompt and reset to the default.
- **Clinic details:** the existing clinic profile. Extra facts (parking, payment methods, emergency advice) are FAQ entries, not new columns.
- **FAQ knowledge base:** skills get a `kind` (`service`, `faq`, `policy`) so the website Services section shows services only, plus optional `keywords` (Bangla and English synonyms) used in ranking.
- **Retrieval by the model first:** only skill titles go in the prompt, up to a cap (proposed 40), so the agent can fetch one by exact title (`get_skill`). `lookup_skill` stays as the search fallback and the only path past the cap. Admin shows how many titles are in the index and the estimated tokens.
- **Retrieval eval:** a test with about 30 Bangla and English phrasings mapped to the expected skill.
- **Later, only if needed:** Cloudflare AI Search behind a `KnowledgeSearch` port, with the keyword search as fallback.

## Acceptance
- [ ] Editing the instructions changes the next call. The safety and booking rules cannot be edited away.
- [ ] An FAQ added in admin is answered correctly on the next call, in Bangla and English.
- [ ] FAQs do not appear in the website Services section.
- [ ] The retrieval eval passes at the agreed target (proposed: the right skill in the top 3 for 90% of phrasings).

## Open questions
See "Knowledge approach" in [decisions](../decisions.md).
