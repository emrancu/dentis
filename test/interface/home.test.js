import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { STRINGS } from '../../public/js/i18n.js';
import { createApp } from '../../src/interface/http/app.js';
import { dentistJsonLd, homeMeta, pickLang, renderHome } from '../../src/interface/http/home.js';
import { buildWorld } from '../support/fixtures.js';

const INDEX = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const ORIGIN = 'https://dentis.example';
const clinic = { name_en: 'Dentis Dental Care', name_bn: 'ডেন্টিস ডেন্টাল কেয়ার', phone: '09638-001122', address: 'House 12, Road 27, Dhanmondi', address_bn: 'বাড়ি ১২, রোড ২৭, ধানমন্ডি', hours: 'Sat–Thu 10 am–8 pm', hours_bn: 'শনি–বৃহ সকাল ১০টা–রাত ৮টা' };
const ld = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);

describe('renderHome', () => {
  it('is Bangla by default and for an unknown language', () => {
    for (const lang of [undefined, null, '', 'fr', 'BN ']) assert.equal(pickLang(lang), 'bn');
    assert.equal(pickLang('en'), 'en');
    assert.match(renderHome(INDEX, { origin: ORIGIN }), /<html lang="bn">/);
  });

  it('sets the language, title and description in the HTML for each language', () => {
    for (const lang of ['bn', 'en']) {
      const html = renderHome(INDEX, { origin: ORIGIN, lang });
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      assert.ok(html.includes(`<title>${homeMeta[lang].title}</title>`));
      assert.ok(html.includes(`<meta name="description" content="${homeMeta[lang].description}">`));
    }
  });

  it('uses the same title and description as the page dictionary, so the two cannot drift', () => {
    for (const lang of ['bn', 'en']) {
      assert.equal(homeMeta[lang].title, STRINGS[lang]['meta.title']);
      assert.equal(homeMeta[lang].description, STRINGS[lang]['meta.description']);
    }
  });

  it('adds a canonical link and hreflang alternates for both languages with absolute URLs', () => {
    const html = renderHome(INDEX, { origin: ORIGIN, lang: 'en' });
    assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}/?lang=en">`));
    assert.ok(html.includes(`<link rel="alternate" hreflang="bn" href="${ORIGIN}/?lang=bn">`));
    assert.ok(html.includes(`<link rel="alternate" hreflang="en" href="${ORIGIN}/?lang=en">`));
    assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/?lang=bn">`));
  });

  it('adds Open Graph and Twitter tags with an absolute image and the right locale', () => {
    const html = renderHome(INDEX, { origin: ORIGIN, lang: 'bn' });
    for (const tag of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:locale', 'og:locale:alternate', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      assert.ok(html.includes(`"${tag}"`), tag);
    }
    assert.ok(html.includes(`<meta property="og:image" content="${ORIGIN}/og.png">`));
    assert.ok(html.includes('<meta property="og:locale" content="bn_BD">'));
    assert.ok(html.includes('<meta property="og:locale:alternate" content="en_GB">'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  });

  it('changes nothing else in the page and still has exactly one head and one title', () => {
    const html = renderHome(INDEX, { origin: ORIGIN, lang: 'bn', site: { clinic } });
    assert.equal(html.split('<title>').length, 2);
    assert.equal(html.split('</head>').length, 2);
    assert.ok(html.includes('<main id="main">'));
    assert.ok(html.includes('id="person"') || html.includes('id="orb"'));
  });

  it('builds Dentist JSON-LD from the clinic data in the visitor language', () => {
    const bn = ld(renderHome(INDEX, { origin: ORIGIN, lang: 'bn', site: { clinic } }));
    assert.deepEqual([bn['@type'], bn.name, bn.alternateName, bn.telephone, bn.url, bn.image], ['Dentist', 'ডেন্টিস ডেন্টাল কেয়ার', 'Dentis Dental Care', '09638-001122', `${ORIGIN}/`, `${ORIGIN}/og.png`]);
    assert.deepEqual(bn.address, { '@type': 'PostalAddress', streetAddress: 'বাড়ি ১২, রোড ২৭, ধানমন্ডি', addressCountry: 'BD' });
    assert.equal(bn.openingHours, 'শনি–বৃহ সকাল ১০টা–রাত ৮টা');
    assert.deepEqual(bn.availableLanguage, ['bn', 'en']);
    const en = ld(renderHome(INDEX, { origin: ORIGIN, lang: 'en', site: { clinic } }));
    assert.equal(en.name, 'Dentis Dental Care');
    assert.equal(en.address.streetAddress, 'House 12, Road 27, Dhanmondi');
  });

  it('falls back to the other language for a field that is empty, and leaves out fields that are empty in both', () => {
    const data = JSON.parse(dentistJsonLd({ clinic: { ...clinic, address: '', hours: '', hours_bn: '', phone: '' }, lang: 'en', origin: ORIGIN }));
    assert.equal(data.address.streetAddress, 'বাড়ি ১২, রোড ২৭, ধানমন্ডি');
    assert.ok(!('openingHours' in data) && !('telephone' in data));
    const none = JSON.parse(dentistJsonLd({ clinic: { name_en: 'X', name_bn: '' }, lang: 'bn', origin: ORIGIN }));
    assert.ok(!('address' in none));
    assert.equal(none.name, 'X');
  });

  it('omits the structured data when the site data is unavailable, but keeps every other tag', () => {
    const html = renderHome(INDEX, { origin: ORIGIN, lang: 'bn', site: null });
    assert.doesNotMatch(html, /application\/ld\+json/);
    assert.ok(html.includes('og:title'));
  });

  it('clinic text can never close the script tag or break an attribute', () => {
    const hostile = { ...clinic, name_en: '</script><script>alert(1)</script>', address: 'a "quoted" <b>address</b>' };
    const html = renderHome(INDEX, { origin: ORIGIN, lang: 'en', site: { clinic: hostile } });
    const block = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1];
    assert.ok(!block.includes('</script>') && !block.includes('<'));
    assert.equal(JSON.parse(block).name, '</script><script>alert(1)</script>');
    assert.equal(html.split('<script>alert(1)').length, 1);
  });
});

describe('GET / through the app', () => {
  let world;
  let app;
  const assets = { calls: 0, fail: false, async fetch(req) {
    this.calls++;
    assert.equal(new URL(req.url).pathname, '/');
    return this.fail ? new Response('missing', { status: 404 }) : new Response(INDEX, { headers: { 'Content-Type': 'text/html' } });
  } };
  const get = (path) => app.handle(new Request(`${ORIGIN}${path}`));

  beforeEach(async () => {
    world = await buildWorld();
    assets.fail = false;
    assets.calls = 0;
    await world.services.clinic.update({ phone: '09638-001122', address: 'House 12', address_bn: 'বাড়ি ১২' });
    app = createApp(world.services, { assets });
  });

  it('serves the page in Bangla by default with the clinic data as JSON-LD', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Content-Type'), /^text\/html; charset=utf-8/);
    assert.match(res.headers.get('Cache-Control'), /max-age=300/);
    const html = await res.text();
    assert.match(html, /<html lang="bn">/);
    const data = ld(html);
    assert.deepEqual([data.name, data.alternateName, data.telephone, data.address.streetAddress], ['ডেন্টিস ডেন্টাল কেয়ার', 'Dentis Dental Care', '09638-001122', 'বাড়ি ১২']);
  });

  it('?lang=en serves the English title and metadata', async () => {
    const html = await (await get('/?lang=en')).text();
    assert.match(html, /<html lang="en">/);
    assert.ok(html.includes('<title>Dentis Dental Care, Dhanmondi, Dhaka</title>'));
    assert.equal(ld(html).address.streetAddress, 'House 12');
  });

  it('an edit in admin shows in the structured data of the next request', async () => {
    await world.services.clinic.update({ phone: '01711-000000' });
    assert.equal(ld(await (await get('/')).text()).telephone, '01711-000000');
  });

  it('passes the asset response through when the page is missing, and never fails because of the data', async () => {
    assets.fail = true;
    assert.equal((await get('/')).status, 404);
    assets.fail = false;
    world.services.getPublicSite.execute = async () => { throw new Error('db down'); };
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.doesNotMatch(await res.text(), /ld\+json/);
  });

  it('does not take over any other path, and the API is unaffected', async () => {
    assert.equal((await get('/index.html')).status, 404);
    assert.equal((await get('/api/public/site')).status, 200);
    assert.equal(assets.calls, 0);
  });

  it('without an assets binding there is no home route', async () => {
    assert.equal((await createApp(world.services).handle(new Request(`${ORIGIN}/`))).status, 404);
  });
});
