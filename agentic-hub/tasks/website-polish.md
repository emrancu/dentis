# Website polish: complete Bangla and English, consistent copy, typography, SEO

- Task id: `website-polish`
- Epic: [landing](../epics/landing.md), [admin](../epics/admin.md)
- Contracts: [http-api](../contracts/http-api.md), [agent-tools](../contracts/agent-tools.md), [data-model](../contracts/data-model.md)
- PR plan: one for all
- Branch: `feature/website-polish`
- Pull request: none yet

## Goal
The website reads as one finished product in **Bangla (the default)** and in **English**: no mixed-language strings, one time and number style, one label per thing, readable Bangla typography, and shareable per-language links. It comes from a website design review (24 findings) of commit `279461b` and the hero redesign `5fe3323`.

## Spec

### Complete in both languages (findings 1, 2)
- Clinic data gets a Bangla twin next to every English display field, so a page never mixes languages:
  - skills: `title_bn`, `description_bn` (the English `title` and `description` become English only; the agent keeps using `title`);
  - doctors: `specialty_bn`;
  - clinic profile: `address_bn`, `hours_bn`, `directions_bn`, `prep_notes_bn`.
- The website shows the Bangla field in Bangla and the English field in English, and falls back to the other language only when one is empty. Admin shows which services are missing a Bangla text.
- Formats, one style per language:
  - times 12-hour: `10:00 am` in English, `সকাল ১০:০০` in Bangla (সকাল, দুপুর, বিকাল, সন্ধ্যা, রাত);
  - Bangla page uses Bangla digits for times and the phone number, English page uses Latin digits;
  - days as a range when consecutive (`Sat–Thu`, `শনি–বৃহ`), otherwise a list;
  - the phone number is a tappable `tel:` link.
- Seed (migration `0005`): English fields become English only, Bangla fields are filled, and a **Dental implants** service is added (the hero already shows implants).

### Copy (findings 3 to 10)
- The floating button is **Talk to us** / **কথা বলুন** (a voice call in the browser, not a phone call). Visit us gets a real phone link.
- The fee promise appears once ("Why Dentis"). Hero lead, services sub-line and step 3 no longer repeat it.
- Nav label = section label: Services, Your first visit, Our dentists, Visit us (Bangla: সেবা, প্রথম ভিজিট, আমাদের ডেন্টিস্ট, আমাদের ঠিকানা). The header and hero booking buttons use the same text.
- Claims are policies we can keep, not boasts: no "Specialists under one roof", no "no surprises". Step 1 is titled for what it says.
- The hero treatment cards use the same names as the Services titles, and a test keeps them equal.
- The hero hint says the same in both languages. Recording notice is shown inside the call panel too.

### Typography and layout (findings 11 to 19)
- Bangla root size +8%, heavier small labels, tighter display leading, a Bangla serif for headings, and a Bangla wordmark next to the logo.
- No hover lift on cards that do nothing, no identical decorative icons, the last row of services and doctors is centred, tap targets are at least 44px, the header booking button appears only after the hero button scrolls away, and on phones the floating button hides while the hero button is on screen.

### Robustness and SEO (findings 20 to 24)
- The 3D fallback stays until the first frame is painted. Three.js and the fonts are self-hosted (no third-party CDN).
- Open Graph and Twitter tags with an image, `Dentist` JSON-LD built from the clinic data, `hreflang` alternates and `?lang=en|bn` links.
- The public footer no longer links to the staff portal. The "demo clinic" line stays (it is true) and is one key to remove before a real launch.

### Out of scope
Separate `/en` URLs rendered on the server, a CMS for the hero cards, photos of doctors, and a native-speaker copy review (needs a person).

## Approved deviations
None.

## Subtasks

- [x] 1. Hub: contracts, decisions, principles, epic
  - parallel: no
  - what: bilingual fields and format policy in the contracts and decisions; new principles; landing epic
  - files: `agentic-hub/**`
  - done when: every field, route and rule in this spec is in a contract
- [x] 2. Bilingual data in domain, migration and repositories
  - parallel: no (after 1)
  - what: Bangla twin fields, migration `0005`, ranking uses Bangla titles, D1 repositories
  - files: `src/domain/**`, `migrations/0005_*.sql`, `src/infrastructure/d1/*`, `test/domain`, `test/infrastructure`, `test/support`
  - done when: the real SQL round-trips every new field and the retrieval eval still passes
- [~] 3. Bilingual data in application and HTTP
  - parallel: no (after 2)
  - what: catalog, directory, clinic profile and public site carry the Bangla fields; agent tools return them
  - files: `src/application/**`, `src/interface/**`, `test/application`, `test/interface`
  - done when: tests prove save, read, fallback and the public payload
- [ ] 4. Admin UI for the Bangla fields
  - parallel: yes (after 3)
  - what: Bangla inputs in the skill, doctor and clinic forms, a "no Bangla" marker on service cards
  - files: `public/admin/**`
  - done when: a screenshot check at desktop and phone width shows the forms and the marker
- [ ] 5. Site copy, formats and labels
  - parallel: yes (after 3)
  - what: new copy in both languages, format helpers, render by language, tel link, talk button, consent line
  - files: `public/index.html`, `public/js/i18n.js`, `public/js/util.js`, `public/js/main.js`, `test/frontend`
  - done when: tests cover formats and language fallback, and the static HTML still equals the Bangla strings
- [ ] 6. Site typography and layout
  - parallel: no (after 5)
  - what: Bangla type scale and serif, wordmark, tap targets, centred grids, header button and floating button behaviour, fallback until first frame
  - files: `public/css/site.css`, `public/js/main.js`, `public/js/hero3d.js` (first frame only)
  - done when: re-run of the audit shows no overlap, targets of at least 44px, no overflow at 360, 768 and 1440 px in both languages
- [ ] 7. Self-hosting and SEO
  - parallel: no (after 6)
  - what: fonts and Three.js served from this site, social image, meta tags, JSON-LD, `hreflang`, `?lang=`
  - files: `public/fonts/**`, `public/vendor/**`, `public/index.html`, `public/css/`, `public/js/main.js`, `public/og.png`
  - done when: the page loads with no request to another host, and the link-preview tags are present
- [ ] 8. Docs
  - parallel: no (after 7)
  - what: README, test counts
  - files: `README.md`
  - done when: README matches what was built
- [ ] 9. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: <to fill>
  - spec changes: <to fill>
  - done when: premortem filled in and spec and contracts match what was built

## Feature pull requests
- [ ] Pull request opened after the premortem
