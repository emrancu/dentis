/** Server-side parts of the home page that crawlers and link previews read without running JavaScript. */

const LANGS = ['bn', 'en'];
const META = {
  bn: {
    title: 'ডেন্টিস ডেন্টাল কেয়ার, ধানমন্ডি, ঢাকা',
    description: 'ডেন্টিস ডেন্টাল কেয়ার, ধানমন্ডি, ঢাকা। পুরো পরিবারের জন্য আরামদায়ক ও আধুনিক ডেন্টাল সেবা।',
    locale: 'bn_BD',
  },
  en: {
    title: 'Dentis Dental Care, Dhanmondi, Dhaka',
    description: 'Dentis Dental Care in Dhanmondi, Dhaka. Gentle, modern dentistry for the whole family.',
    locale: 'en_GB',
  },
};

export const homeMeta = META;
export const pickLang = (value) => (LANGS.includes(value) ? value : 'bn');

const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const field = (lang, en, bn) => (lang === 'bn' ? bn || en : en || bn) || '';

/** The Dentist structured data, from the clinic profile in the visitor's language. */
export function dentistJsonLd({ clinic, lang, origin }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: lang === 'bn' ? clinic.name_bn || clinic.name_en : clinic.name_en,
    alternateName: lang === 'bn' ? clinic.name_en : clinic.name_bn,
    url: `${origin}/`,
    image: `${origin}/og.png`,
    description: META[lang].description,
    availableLanguage: ['bn', 'en'],
    ...(clinic.phone ? { telephone: clinic.phone } : {}),
    ...(field(lang, clinic.address, clinic.address_bn)
      ? { address: { '@type': 'PostalAddress', streetAddress: field(lang, clinic.address, clinic.address_bn), addressCountry: 'BD' } }
      : {}),
    ...(field(lang, clinic.hours, clinic.hours_bn) ? { openingHours: field(lang, clinic.hours, clinic.hours_bn) } : {}),
  };
  // "<" is escaped so clinic text can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Takes the static index.html and returns it for one language, with canonical and hreflang links,
 * Open Graph and Twitter tags and JSON-LD. `site` is the public site payload, or null when it is unavailable.
 */
export function renderHome(html, { origin, lang: requested, site = null }) {
  const lang = pickLang(requested);
  const m = META[lang];
  const url = (l) => `${origin}/?lang=${l}`;
  const head = [
    `<link rel="canonical" href="${attr(url(lang))}">`,
    `<link rel="alternate" hreflang="bn" href="${attr(url('bn'))}">`,
    `<link rel="alternate" hreflang="en" href="${attr(url('en'))}">`,
    `<link rel="alternate" hreflang="x-default" href="${attr(url('bn'))}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${attr(META.en.title.split(',')[0])}">`,
    `<meta property="og:title" content="${attr(m.title)}">`,
    `<meta property="og:description" content="${attr(m.description)}">`,
    `<meta property="og:url" content="${attr(url(lang))}">`,
    `<meta property="og:image" content="${attr(`${origin}/og.png`)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:locale" content="${m.locale}">`,
    `<meta property="og:locale:alternate" content="${META[lang === 'bn' ? 'en' : 'bn'].locale}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${attr(m.title)}">`,
    `<meta name="twitter:description" content="${attr(m.description)}">`,
    `<meta name="twitter:image" content="${attr(`${origin}/og.png`)}">`,
    ...(site?.clinic ? [`<script type="application/ld+json">${dentistJsonLd({ clinic: site.clinic, lang, origin })}</script>`] : []),
  ].join('\n  ');

  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${attr(m.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(m.description)}">`)
    .replace('</head>', `  ${head}\n</head>`);
}

export function registerHomeRoute(router, services, assets) {
  router.add('GET', '/', async ({ request }) => {
    const url = new URL(request.url);
    const page = await assets.fetch(new Request(new URL('/', url.origin)));
    if (!page.ok) return page;
    const site = await services.getPublicSite.execute().catch(() => null); // the page still works without structured data
    const html = renderHome(await page.text(), { origin: url.origin, lang: url.searchParams.get('lang'), site });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  });
}
