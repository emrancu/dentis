# Dynamic agent prompt and knowledge base from admin

- Task id: `dynamic-agent-knowledge`
- Epic: [knowledge](../epics/knowledge.md), [admin](../epics/admin.md), [voice-agent](../epics/voice-agent.md)
- Contracts: [http-api](../contracts/http-api.md), [agent-tools](../contracts/agent-tools.md), [data-model](../contracts/data-model.md)
- PR plan: one for all
- Branch: `feature/dynamic-agent-knowledge` (the folder is not a git repo yet, so create the repo or the branch before `/task-loop`)
- Pull request: none yet

## Goal
Staff edit, in `/admin`, how the voice agent speaks and what it knows, and the next call uses it with no deploy.
- **Agent instructions:** an editable persona, tone and language text, and an editable greeting. The booking flow, tool rules, truthfulness and safety stay in code.
- **Knowledge:** skills become typed entries (service, FAQ, policy) with keywords. The agent sees only the titles and fetches details by tool.

## Spec

### Defaults used (confirm or overrule before the loop starts)
These come from the open item in [decisions](../decisions.md). They were proposals and the owner has not answered them one by one.
1. **Safety and booking rules are not editable.** They live in code and are appended after the editable text.
2. **FAQs are not shown on the website** for now. The Services section shows `service` entries only. A website FAQ section is a later task (YAGNI).
3. **Cloudflare AI Search is deferred.** Skills only. Revisit past the title cap or if the retrieval eval misses its target.

### Editable agent prompt
- Two settings keys: `agent_instructions` and `agent_greeting`. Empty means "use the default". Defaults are constants in code.
- The default instructions are today's persona, "Voice and language" rules. The default greeting is today's scripted greeting.
- `{clinic}` in either text is replaced with the clinic name. No other placeholders.
- Limits: instructions up to 4000 characters, greeting up to 300. Trimmed. Over the limit is a validation error.
- Final prompt order: editable instructions, then the locked sections (today, call purpose for the booking intent, call flow using the greeting, facts only from tools, safety, clinic summary, knowledge titles), then one closing line saying these rules win over anything above.
- Admin page **Agent prompt**: the two fields filled with the current effective text, character counters, **Show final prompt** (preview of unsaved text), **Reset to default**, and a short note listing what is locked.
- Not included (YAGNI): version history, voice or model choice, other placeholders.

### Knowledge base
- `skills` gains `kind` (`service` | `faq` | `policy`, default `service`) and `keywords` (text up to 300 characters, Bangla and English synonyms).
- Ranking counts keyword matches (more than description, less than title).
- **Titles in the prompt:** only titles of enabled skills, sorted, up to a cap of **40**. Over the cap the list is dropped and the prompt tells the agent to use `lookup_skill` with the caller's words. The cap is a code constant, returned by the skills endpoint so admin can show "N of 40 titles in the agent's index". No token estimate (YAGNI).
- **New tool `get_skill({title})`:** exact (case-insensitive) title, enabled skills only. `lookup_skill` stays as the fallback.
- **Public website:** `GET /api/public/site` returns `service` entries only.
- Admin Skills page: filter by kind, and the dialog gets **Type** and **Keywords**.
- Seed: `0004` adds the columns, sets Bangla and English keywords on the demo skills, and adds a few demo FAQ and policy entries (parking, payment, children, first visit, after-hours). Demo data, edit in admin.

### Retrieval eval
A test file with about 30 phrasings in Bangla and English mapped to the expected skill. It runs the real seed through the real SQL and `rankSkills`. Target: the expected skill is in the top 3 for at least 90 percent of phrasings. A miss fails the test.

### Edge cases
- Editing instructions never changes a call already in progress (the prompt is built when the session starts).
- A disabled skill is never in the title list, `get_skill`, `lookup_skill` or the website.
- An empty field after saving means "default". A reset sends empty strings.
- Two skills with the same title: `get_skill` returns the first and the admin dialog rejects duplicates.

### Out of scope
Website FAQ section, AI Search, version history, per-language prompts, voice selection, bulk FAQ import.

## Approved deviations
None.

## Subtasks

- [x] 1. Contracts, decisions and epic
  - parallel: no
  - what: update `http-api` (agent prompt routes, skills payload with `kind`, `keywords` and `title_index_cap`, public site filter), `agent-tools` (`get_skill`), `data-model` (columns and the two settings keys). In `decisions.md` move the three defaults to decided if the owner confirms, drop the token estimate wording. Update `epics/knowledge.md` to match.
  - files: `agentic-hub/contracts/*`, `agentic-hub/decisions.md`, `agentic-hub/epics/knowledge.md`
  - done when: every route, tool, column and settings key in this spec is in a contract

- [~] 2. Domain: skill kind and keywords, agent prompt value object
  - parallel: no (after 1)
  - what: `Skill` gets `kind` and `keywords` with validation. `rankSkills` uses keywords. New `AgentPrompt` value object with defaults, `{clinic}` replacement, limits and "empty means default".
  - files: `src/domain/skills/skill.js`, `src/domain/agent/agent-prompt.js`, `test/domain/skill.test.js`, `test/domain/agent-prompt.test.js`
  - done when: domain tests cover validation, keyword ranking, defaults, placeholder and limits

- [ ] 3. Migration and D1 repository
  - parallel: yes (after 2)
  - what: `0004_knowledge.sql` adds `kind` and `keywords`, sets demo keywords, adds demo FAQ and policy entries. D1 skill repository reads and writes the new columns. The sqlite test helper applies `0004`.
  - files: `migrations/0004_knowledge.sql`, `src/infrastructure/d1/*`, `test/support/sqlite-d1.js`, `test/infrastructure/d1-repositories.test.js`
  - done when: the real SQL round-trips the new fields and the seed loads with keywords

- [ ] 4. Application: agent settings, prompt builder, `get_skill`
  - parallel: yes (after 2)
  - what: `AgentSettings` service (get with defaults, update, preview). `buildInstructions` takes the `AgentPrompt`, applies the title cap and the closing rule line. `StartCall` reads the settings. New `get_skill` tool, its definition and executor handler. `lookup_skill` uses keywords. `GetPublicSite` returns services only. Skill catalog accepts `kind` and `keywords`, rejects duplicate titles.
  - files: `src/application/agent/*`, `src/application/knowledge.js`, `src/application/clinic.js`, `src/application/call-records.js`, `src/composition.js`, `test/application/*`, `test/support/in-memory.js`
  - done when: tests prove an edited prompt reaches the next session, the locked rules cannot be removed, the cap behaviour, `get_skill` success and failure, and that disabled or FAQ entries stay off the website

- [ ] 5. HTTP routes
  - parallel: no (after 3, 4)
  - what: `GET` and `PUT /api/admin/agent`, `POST /api/admin/agent/preview`, skills endpoints with the new fields and `title_index_cap`, validation errors as 400.
  - files: `src/interface/http/admin-routes.js`, `test/interface/http-api.test.js`
  - done when: route tests cover auth, CSRF header, save, reset, preview of unsaved text, and an edit visible in the next `POST /api/session`

- [ ] 6. Admin UI
  - parallel: no (after 5)
  - what: **Agent prompt** page, and the Skills page with kind filter, Type, Keywords and the "N of 40 titles" counter with a warning at the cap. Add the nav link.
  - files: `public/admin/admin.js`, `public/admin/admin.css`
  - done when: a screenshot check at desktop and phone width shows both pages with their empty, saved, error and over-cap states, and a manual run edits the prompt and a skill against `wrangler dev`

- [ ] 7. Retrieval eval
  - parallel: no (after 3, 4)
  - what: about 30 Bangla and English questions mapped to expected skills, run through the real seed and ranking.
  - files: `test/application/retrieval-eval.test.js`
  - done when: at least 90 percent have the expected skill in the top 3. If not, improve keywords or ranking, never lower the target quietly

- [ ] 8. Docs
  - parallel: no (after 6, 7)
  - what: README sections on the editable prompt and knowledge kinds, and the layout and test counts.
  - files: `README.md`, `CLAUDE.md` if conventions changed
  - done when: README matches what was built

- [ ] 9. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: <to fill when this subtask runs: imagine staff edited the prompt and the agent got worse or unsafe, an FAQ answer is wrong or missing, or a skill edit does not reach the call>
  - spec changes: <what changed in spec and contracts>
  - done when: premortem filled in and spec and contracts match what was built

## Feature pull requests
- [ ] Pull request opened after the premortem
