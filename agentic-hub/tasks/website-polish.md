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
- [x] 3. Bilingual data in application and HTTP
  - parallel: no (after 2)
  - what: catalog, directory, clinic profile and public site carry the Bangla fields; agent tools return them
  - files: `src/application/**`, `src/interface/**`, `test/application`, `test/interface`
  - done when: tests prove save, read, fallback and the public payload
- [x] 4. Admin UI for the Bangla fields
  - parallel: yes (after 3)
  - what: Bangla inputs in the skill, doctor and clinic forms, a "no Bangla" marker on service cards
  - files: `public/admin/**`
  - done when: a screenshot check at desktop and phone width shows the forms and the marker
- [x] 5. Site copy, formats and labels
  - parallel: yes (after 3)
  - what: new copy in both languages, format helpers, render by language, tel link, talk button, consent line
  - files: `public/index.html`, `public/js/i18n.js`, `public/js/util.js`, `public/js/main.js`, `test/frontend`
  - done when: tests cover formats and language fallback, and the static HTML still equals the Bangla strings
- [x] 6. Site typography and layout
  - parallel: no (after 5)
  - what: Bangla type scale and serif, wordmark, tap targets, centred grids, header button and floating button behaviour, fallback until first frame
  - files: `public/css/site.css`, `public/js/main.js`, `public/js/hero3d.js` (first frame only)
  - done when: re-run of the audit shows no overlap, targets of at least 44px, no overflow at 360, 768 and 1440 px in both languages
- [x] 7. Self-hosting and SEO
  - parallel: no (after 6)
  - what: fonts and Three.js served from this site, social image, meta tags, JSON-LD, `hreflang`, `?lang=`
  - files: `public/fonts/**`, `public/vendor/**`, `public/index.html`, `public/css/`, `public/js/main.js`, `public/og.png`
  - done when: the page loads with no request to another host, and the link-preview tags are present
- [x] 8. Docs
  - parallel: no (after 7)
  - what: README, test counts
  - files: `README.md`
  - done when: README matches what was built
- [x] 9. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: see the table below
  - spec changes: see the list below
  - done when: premortem filled in and spec and contracts match what was built

### Premortem
Imagine the site went live and visitors or staff still found it inconsistent, slow or broken.

| Likely cause | Covered by |
|---|---|
| Staff add a service but forget the Bangla text, so the Bangla page shows an English card | The site falls back to the other language (tested) and admin shows a "No Bangla text for the website" marker on the card. It is a warning, not a block. |
| Staff rename a service in admin and the hero card keeps the old name | The four hero treatment names are fixed dictionary strings. A test keeps them equal to the **seed** data only. Renaming a service later is not caught. Known limitation of a hero with four fixed 3D models. |
| The migrations break an existing database | `0005` adds columns once (tracked), `0006` is safe to run twice (tested, including no duplicate implants). Applied on a real local D1. **Not run on a remote D1.** |
| The Worker now serves `/`, so a data or asset problem takes the home page down | The page is served without JSON-LD when the clinic data fails, and the asset response is passed through when the page is missing (both tested). **Only run under `wrangler dev`, not deployed**, so `env.ASSETS.fetch("/")` under `run_worker_first` is verified locally only. |
| Each page view reads the database for the JSON-LD | One small read, `max-age=300`, with a fallback. **Load was not measured** and there is no edge cache. |
| A shared `?lang=` link and a saved choice disagree | The link wins and the address bar follows the toggle (tested). |
| The Bangla wording sounds off to a native reader | Both languages are checked for consistency by tests, **but no native speaker has read them.** "অ্যাপয়েন্টমেন্ট" vs "সিরিয়াল" is the open example. |
| A crawler indexes only the Bangla body | Metadata, `hreflang` and JSON-LD are per language, but the body text is client-rendered. Documented, not fixed. |
| Fonts or Three.js fail to load | Both are served from this site. A missing 3D library shows the fallback tooth, and a missing font falls back to system fonts. Tested for the file names and ranges, not for a failed download. |
| Tap targets feel small on a phone | All controls measure at least 44px except the hero treatment pills (32px with an invisible 44px hit area). |
| The other person's hero work and mine collide | The first-frame hook in `hero3d.js` is the only change to their scene code. Their hero commit was built on, not rewritten. |

### Spec changes
- **Migrations:** the schema and the data are two files, `0005_bilingual_columns.sql` and `0006_bilingual_content.sql`, so tests can create an empty schema. The test helper lists the schema-only files.
- **SEO is server-side.** The spec said the JSON-LD would be built in the browser. It is written by the Worker (`GET /`), which also fixes the missing language for crawlers. Contract and decisions updated.
- **Agent-only entries** (FAQ, policy) also got Bangla twin text, so no entry in admin mixes languages.
- **Implants:** a "Dental implants" service was added to the seed because the hero shows it. A test ties the hero names to the service names.
- **Bangla serif and sizes** shipped as planned. Self-hosted font weights: Inter 400/500/600, Fraunces 500/600, Hind Siliguri 400/500/600, Noto Serif Bengali 500/600.
- **Finding 15 (cards that go nowhere)** is fixed only in part: the fake hover lift and the identical icons are gone, but the cards still have no action. A "ask about this" action would need a topic-aware call and is a separate task.
- **Finding 24:** the staff-portal link left the public footer. The "demo clinic with sample data" line stays on purpose and is one dictionary key.

## Feature pull requests
- [ ] Pull request opened after the premortem
