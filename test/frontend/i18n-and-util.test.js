import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { STRINGS, daysLabel, t } from '../../public/js/i18n.js';
import { esc, formatDateTime, formatDuration, formatSlot, formatTime, statusLabel } from '../../public/js/util.js';

const read = (path) => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
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
    assert.equal(daysLabel([0, 6, 1], 'en'), 'Sat, Sun, Mon');
    assert.equal(daysLabel([6], 'bn'), 'শনি');
    assert.equal(daysLabel([], 'en'), '');
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

  it('the 3D tooth cleans up on hover, tap and during a call, and spins on drag', () => {
    const scene = read('js/hero3d.js');
    assert.match(scene, /hover \|\| pinned \|\| active\(\)/);
    assert.match(scene, /pointerdown/);
    assert.match(read('js/main.js'), /in-call/);
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

  it('the illustration hint exists in both languages', () => {
    assert.ok(STRINGS.en['art.hint'] && STRINGS.bn['art.hint']);
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
