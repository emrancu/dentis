import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { DEFAULT_LANG, STRINGS, daysLabel, t } from '../../public/js/i18n.js';
import { esc, formatClock, formatClockRange, formatDateTime, formatDuration, formatSlot, formatTime, localDigits, pick, statusLabel, telHref } from '../../public/js/util.js';
import { D1SkillRepository } from '../../src/infrastructure/d1/content-repositories.js';
import { createD1 } from '../support/sqlite-d1.js';

const read = (path) => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
const html = () => read('index.html');
const keysIn = (text, attr) => [...text.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1]);

describe('landing page copy', () => {
  it('English and Bangla have exactly the same keys', () => {
    assert.deepEqual(Object.keys(STRINGS.bn).sort(), Object.keys(STRINGS.en).sort());
  });

  it('no string is empty', () => {
    for (const lang of ['en', 'bn']) for (const [key, value] of Object.entries(STRINGS[lang])) assert.ok(value.trim(), `${lang}.${key}`);
  });

  it('every data-i18n key used in index.html exists', () => {
    const html = read('index.html');
    const used = [...keysIn(html, 'data-i18n'), ...keysIn(html, 'data-i18n-html'), ...keysIn(html, 'data-i18n-aria')];
    assert.ok(used.length > 30);
    for (const key of used) assert.ok(key in STRINGS.en, `missing key: ${key}`);
  });

  it('every error message the call client can raise has a translation', () => {
    for (const kind of ['mic_denied', 'no_mic', 'unsupported', 'rate_limited', 'session_failed', 'connection_failed', 'dropped']) {
      assert.ok(STRINGS.en[`error.${kind}`] && STRINGS.bn[`error.${kind}`], kind);
    }
  });

  it('the Bangla copy is really Bangla', () => {
    for (const key of ['hero.title', 'hero.lead', 'cta.book', 'fab.label', 'how.1.d', 'call.done.text']) assert.match(STRINGS.bn[key], /[\u0980-\u09FF]/, key);
  });

  it('falls back to English, then to the key', () => {
    assert.equal(t('bn', 'nav.how'), STRINGS.bn['nav.how']);
    assert.equal(t('xx', 'nav.how'), STRINGS.en['nav.how']);
    assert.equal(t('en', 'no.such.key'), 'no.such.key');
  });

  it('the markup in HTML strings is limited to <em>', () => {
    for (const lang of ['en', 'bn']) for (const value of Object.values(STRINGS[lang])) assert.equal(value.replace(/<\/?em>/g, '').includes('<'), false, value);
  });

  it('labels doctor days starting from Saturday', () => {
    assert.equal(daysLabel([0, 6], 'en'), 'Sat, Sun');
    assert.equal(daysLabel([6], 'bn'), 'শনি');
    assert.equal(daysLabel([], 'en'), '');
  });
});

describe('one style per language', () => {
  it('shows consecutive working days as a range and others as a list', () => {
    assert.equal(daysLabel([6, 0, 1, 2, 3, 4], 'en'), 'Sat–Thu');
    assert.equal(daysLabel([6, 0, 1, 2, 3, 4], 'bn'), 'শনি–বৃহ');
    assert.equal(daysLabel([0, 2, 4], 'en'), 'Sun, Tue, Thu');
    assert.equal(daysLabel([6, 1, 3], 'bn'), 'শনি, সোম, বুধ');
    assert.equal(daysLabel([6, 0], 'en'), 'Sat, Sun');
  });

  it('times are 12-hour in English and carry a part of the day in Bangla, with Bangla digits', () => {
    assert.equal(formatClock('10:00', 'en'), '10:00 am');
    assert.equal(formatClock('17:30', 'en'), '5:30 pm');
    assert.equal(formatClock('12:00', 'en'), '12:00 pm');
    assert.equal(formatClock('00:15', 'en'), '12:15 am');
    assert.equal(formatClock('10:00', 'bn'), 'সকাল ১০:০০');
    assert.equal(formatClock('12:00', 'bn'), 'দুপুর ১২:০০');
    assert.equal(formatClock('16:45', 'bn'), 'বিকাল ৪:৪৫');
    assert.equal(formatClock('18:30', 'bn'), 'সন্ধ্যা ৬:৩০');
    assert.equal(formatClock('20:00', 'bn'), 'রাত ৮:০০');
    assert.equal(formatClock('05:00', 'bn'), 'ভোর ৫:০০');
    assert.equal(formatClockRange('10:00', '17:00', 'en'), '10:00 am–5:00 pm');
    assert.equal(formatClockRange('10:00', '17:00', 'bn'), 'সকাল ১০:০০–বিকাল ৫:০০');
  });

  it('the English page never contains Bangla digits or words, and the Bangla page never contains Latin digits in times', () => {
    for (const t of ['00:00', '09:05', '13:30', '23:59']) {
      assert.doesNotMatch(formatClock(t, 'en'), /[\u0980-\u09FF]/);
      assert.doesNotMatch(formatClock(t, 'bn'), /[0-9]/);
    }
  });

  it('digits and phone numbers follow the language', () => {
    assert.equal(localDigits('09638-001122', 'bn'), '০৯৬৩৮-০০১১২২');
    assert.equal(localDigits('09638-001122', 'en'), '09638-001122');
    assert.equal(localDigits(null, 'bn'), '');
    assert.equal(telHref('09638-001122'), 'tel:09638001122');
    assert.equal(telHref('+880 1712-345678'), 'tel:+8801712345678');
    assert.equal(telHref(''), '');
  });

  it('shows the visitor language first and falls back to the other only when it is empty', () => {
    assert.equal(pick('bn', 'Fillings', 'ফিলিং'), 'ফিলিং');
    assert.equal(pick('en', 'Fillings', 'ফিলিং'), 'Fillings');
    assert.equal(pick('bn', 'Fillings', ''), 'Fillings');
    assert.equal(pick('en', '', 'ফিলিং'), 'ফিলিং');
    assert.equal(pick('bn', undefined, undefined), '');
  });
});

describe('consistent names and one message per place', () => {
  for (const lang of ['en', 'bn']) {
    it(`${lang}: the navigation label is the section label, and every booking button says the same`, () => {
      const S = STRINGS[lang];
      assert.equal(S['nav.services'], S['services.eyebrow']);
      assert.equal(S['nav.how'], S['how.eyebrow']);
      assert.equal(S['nav.doctors'], S['doctors.eyebrow']);
      assert.equal(S['nav.visit'], S['visit.eyebrow']);
      assert.equal(S['nav.book'], S['cta.book']);
      assert.equal(S['visit.cta'], S['cta.book']);
    });

    it(`${lang}: the fee promise is made once, in "Why Dentis", not in the hero, the services intro or the steps`, () => {
      const fee = lang === 'en' ? /\bfees?\b|\bcosts?\b|\bprice/i : /ফি|খরচ|দাম/;
      const offenders = Object.keys(STRINGS[lang]).filter((k) => /^(hero|services|how|tx|doctors|visit)\./.test(k) && fee.test(STRINGS[lang][k]));
      assert.deepEqual(offenders, []);
      assert.ok(fee.test(STRINGS[lang]['why.1.d']));
    });

    it(`${lang}: no boasts that depend on data we do not control`, () => {
      const all = Object.values(STRINGS[lang]).join(' ').toLowerCase();
      for (const phrase of ['specialists under one roof', 'no surprises', 'unhurried', 'এক ছাদের নিচে', 'কোনো চমক']) assert.ok(!all.includes(phrase), phrase);
    });
  }

  it('the floating button says it is a voice conversation, not a phone call', () => {
    assert.equal(STRINGS.en['fab.label'], 'Talk to us');
    assert.equal(STRINGS.bn['fab.label'], 'কথা বলুন');
    assert.doesNotMatch(STRINGS.en['fab.label'] + STRINGS.en['fab.aria'], /\bcall\b/i);
  });

  it('the call panel shows the recording notice in both languages', () => {
    assert.match(STRINGS.en['call.consent'], /recorded/);
    assert.match(STRINGS.bn['call.consent'], /রেকর্ড/);
    assert.match(html(), /class="call-consent"/);
  });

  it('the public footer has no link to the staff portal', () => {
    assert.doesNotMatch(html().split('<footer')[1], /\/admin/);
  });

  it('the hero treatment cards use exactly the names and texts of the Services data, in both languages', async () => {
    const services = (await new D1SkillRepository(createD1({ seed: true })).list()).filter((s) => s.kind === 'service');
    const byTitle = new Map(services.map((s) => [s.title, s]));
    const pairs = { checkup: 'Check-up and consultation', whitening: 'Teeth whitening', braces: 'Braces and aligners', implant: 'Dental implants' };
    for (const [key, title] of Object.entries(pairs)) {
      const svc = byTitle.get(title);
      assert.ok(svc, `no service "${title}" in the seed`);
      assert.equal(STRINGS.en[`tx.${key}.name`], svc.title);
      assert.equal(STRINGS.en[`tx.${key}.text`], svc.description);
      assert.equal(STRINGS.bn[`tx.${key}.name`], svc.titleBn);
      assert.equal(STRINGS.bn[`tx.${key}.text`], svc.descriptionBn);
    }
  });

  it('every dictionary key is used by the page (no dead copy)', () => {
    const source = html() + read('js/main.js');
    const dynamic = /^(error\.|call\.|tx\.)/;
    const unused = Object.keys(STRINGS.en).filter((k) => !dynamic.test(k) && !source.includes(`"${k}"`) && !source.includes(`'${k}'`));
    assert.deepEqual(unused, []);
  });
});

describe('Bangla is the default language', () => {
  const html = read('index.html');

  it('the default is Bangla, and a visitor choice (not the browser language) is the only thing that overrides it', () => {
    assert.equal(DEFAULT_LANG, 'bn');
    const main = read('js/main.js');
    assert.match(main, /return DEFAULT_LANG;/);
    assert.doesNotMatch(main, /navigator\.language/);
  });

  it('the page is Bangla before any script runs: html lang, title and description', () => {
    assert.match(html, /<html lang="bn">/);
    assert.ok(html.includes(`<title>${STRINGS.bn['meta.title']}</title>`));
    assert.ok(html.includes(`<meta name="description" content="${STRINGS.bn['meta.description']}">`));
  });

  it('every translatable element holds the Bangla text in the static HTML, so there is no flash of English', () => {
    const drift = [];
    for (const m of html.matchAll(/<[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)</g)) if (m[2] !== STRINGS.bn[m[1]]) drift.push(`${m[1]}: "${m[2]}"`);
    for (const m of html.matchAll(/<[^>]*\sdata-i18n-html="([^"]+)"[^>]*>(.*?)<\/h1>/gs)) if (m[2] !== STRINGS.bn[m[1]]) drift.push(`${m[1]}: "${m[2]}"`);
    for (const m of html.matchAll(/<[^>]*\sdata-i18n-aria="([^"]+)"[^>]*>/g)) {
      const label = /aria-label="([^"]*)"/.exec(m[0])?.[1];
      if (label !== STRINGS.bn[m[1]].replace(/"/g, '&quot;')) drift.push(`${m[1]} aria-label: "${label}"`);
    }
    assert.deepEqual(drift, []);
  });

  it('the language button offers the other language and is marked with its language', () => {
    assert.match(html, /<button class="lang-btn"[^>]*lang="en"[^>]*>English<\/button>/);
  });

  it('the skip link is translatable too', () => {
    assert.ok(STRINGS.en.skip && STRINGS.bn.skip);
    assert.match(html, /class="skip"[^>]*data-i18n="skip"/);
  });
});

describe('layout rules that protect the review findings', () => {
  const css = read('css/site.css');
  const main = read('js/main.js');

  it('the header booking button stays hidden until the hero button scrolls away', () => {
    assert.match(css, /\.btn-book \{ opacity: 0; visibility: hidden;/);
    assert.match(css, /\.site-header\.show-book \.btn-book \{ opacity: 1;/);
    assert.match(main, /classList\.toggle\('show-book'/);
  });

  it('on phones the floating button yields to the hero button', () => {
    assert.match(css, /\.hero-cta-visible \.fab \{ opacity: 0;/);
    assert.match(main, /classList\.toggle\('hero-cta-visible'/);
  });

  it('the 3D stage replaces the fallback only after its first painted frame', () => {
    assert.match(main, /onReady: \(\) => document\.body\.classList\.add\('has-3d'\)/);
    assert.doesNotMatch(main, /if \(hero\) document\.body\.classList\.add\('has-3d'\)/);
    assert.match(css, /\.has-3d \.tooth-fallback \{ opacity: 0; \}/);
    assert.match(read('js/hero3d.js'), /onReady\(\)/);
  });

  it('touch targets are at least 44px for the header, navigation, footer links and inline links', () => {
    for (const rule of [/\.nav a \{ min-height: 44px/, /\.brand \{ min-height: 44px/, /\.footer-links a \{[^}]*min-height: 44px/, /\.facts a, \.footer-contact a \{[^}]*min-height: 44px/, /\.menu-btn \{ display: none; width: 44px; height: 44px/]) assert.match(css, rule);
    assert.match(css, /\.btn-book \{[^}]*min-height: 44px/);
    assert.match(css, /\.lang-btn \{[^}]*min-height: 44px/);
  });

  it('cards that do nothing do not lift on hover, and rows are centred so there is no orphan', () => {
    assert.doesNotMatch(css, /\.card:hover/);
    assert.doesNotMatch(css, /\.doctor:hover/);
    assert.match(css, /\.cards \{ display: flex; flex-wrap: wrap; justify-content: center;/);
    assert.match(css, /\.doctors \{ display: flex; flex-wrap: wrap; justify-content: center;/);
  });

  it('Bangla gets a larger root size, tighter display leading and a serif for headings', () => {
    assert.match(css, /html\[lang='bn'\] \{ font-size: 108%; \}/);
    assert.match(css, /html\[lang='bn'\] h1 \{ line-height: 1\.25; \}/);
    assert.match(css, /html\[lang='bn'\] h1[^{]*\{ font-family: 'Noto Serif Bengali'/);
  });

  it('the header shows the Bangla name next to the logo', () => {
    assert.match(html(), /class="brand-bn" lang="bn">ডেন্টিস ডেন্টাল কেয়ার</);
  });
});

describe('static pages', () => {
  it('the hero has a canvas for the 3D tooth and a static tooth as the fallback', () => {
    const html = read('index.html');
    assert.match(html, /<canvas class="stage-canvas" id="stage-canvas"/);
    assert.match(html, /class="tooth-fallback"/);
    assert.match(html, /<meta name="viewport"/);
  });

  it('Three.js is loaded from a pinned version', () => {
    const html = read('index.html');
    assert.match(html, /three@\d+\.\d+\.\d+\/build\/three\.module\.js/);
  });

  it('the 3D scene has a model per treatment, spins on drag and the tabs drive it', () => {
    const scene = read('js/hero3d.js');
    assert.match(scene, /TREATMENTS = \['checkup', 'whitening', 'braces', 'implant'\]/);
    assert.match(scene, /pointerdown/);
    assert.equal(read('index.html').split('class="tx-tab"').length - 1, 4);
    assert.match(read('js/main.js'), /hero\?\.show\(treatment\)/);
    assert.match(read('css/site.css'), /\.has-3d \.tooth-fallback/);
  });

  it('the old trust chips are gone', () => {
    assert.doesNotMatch(read('index.html'), /class="chips"/);
    assert.doesNotMatch(read('css/site.css'), /\.chips/);
  });

  it('the hero headline and sub-copy are about dental care, not booking or speed', () => {
    for (const lang of ['en', 'bn']) {
      for (const key of ['hero.title', 'hero.lead']) assert.doesNotMatch(STRINGS[lang][key], /appointment|book|অ্যাপয়েন্টমেন্ট|বুকিং|minute|মিনিট/i, `${lang}.${key}`);
    }
  });

  it('every treatment has a name, text and short label in both languages', () => {
    for (const lang of ['en', 'bn']) {
      for (const key of ['checkup', 'whitening', 'braces', 'implant']) {
        for (const part of ['name', 'text', 'short']) assert.ok(STRINGS[lang][`tx.${key}.${part}`], `${lang} tx.${key}.${part}`);
      }
    }
  });

  it('the admin page is not indexable and the SPA entry exists', () => {
    assert.match(read('admin/index.html'), /name="robots" content="noindex"/);
    assert.ok(readdirSync(new URL('../../public/admin/', import.meta.url)).includes('admin.js'));
  });

  it('the logo files are valid SVG with the Dentis name', () => {
    for (const file of ['logo.svg', 'logo-mark.svg', 'favicon.svg']) assert.match(read(file), /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, file);
    assert.match(read('logo.svg'), />Dentis</);
  });
});

describe('util', () => {
  it('esc neutralises HTML in every dangerous position', () => {
    assert.equal(esc('<img src=x onerror="a()">&\'"'), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;&quot;');
    assert.equal(esc(null), '');
    assert.equal(esc(42), '42');
  });

  it('formats durations', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(125), '2:05');
    assert.equal(formatDuration(3725), '1:02:05');
    assert.equal(formatDuration(null), '–');
    assert.equal(formatDuration(-4), '0:00');
  });

  it('formats instants in Dhaka time', () => {
    assert.equal(formatDateTime('2026-11-14T04:00:00.000Z'), '14 Nov 2026, 10:00 am');
    assert.equal(formatDateTime('2026-11-14T19:30:00.000Z'), '15 Nov 2026, 1:30 am');
    assert.equal(formatDateTime(null), '–');
    assert.equal(formatTime('2026-11-14T04:00:05.000Z'), '10:00:05 am');
  });

  it('formats clinic slots with weekday and 12-hour time', () => {
    assert.equal(formatSlot('2026-11-16T18:30'), 'Mon 16 Nov, 6:30 pm');
    assert.equal(formatSlot('2026-11-15T00:00'), 'Sun 15 Nov, 12:00 am');
    assert.equal(formatSlot('2026-11-15T12:05'), 'Sun 15 Nov, 12:05 pm');
    assert.equal(formatSlot(''), '–');
  });

  it('labels every status the API can return', () => {
    for (const s of ['in_progress', 'booked', 'rescheduled', 'cancelled', 'enquiry', 'follow_up_needed', 'incomplete', 'failed', 'completed', 'open', 'resolved']) assert.notEqual(statusLabel(s), s);
    assert.equal(statusLabel('mystery'), 'mystery');
  });
});
