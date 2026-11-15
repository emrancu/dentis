import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { SERVICES } from '../../public/website/js/services.js';

describe('website services', () => {
  it('every service has an English and a Bangla title and text', () => {
    assert.ok(SERVICES.length >= 6);
    for (const s of SERVICES) {
      for (const lang of ['en', 'bn']) assert.ok(s[lang].length === 2 && s[lang].every((x) => x.trim()), `${lang}: ${s.en[0]}`);
    }
  });

  it('English text has no Bangla letters and Bangla text has no Latin words', () => {
    for (const s of SERVICES) {
      assert.ok(s.en.every((x) => !/[\u0980-\u09FF]/.test(x)), s.en[0]);
      assert.ok(s.bn.every((x) => !/[A-Za-z]{3,}/.test(x)), s.bn[0]);
    }
  });

  it('the page renders them without calling the API', () => {
    const main = readFileSync(new URL('../../public/website/js/main.js', import.meta.url), 'utf8');
    assert.match(main, /function renderServices\(\)/);
    assert.ok(!/site\.skills|skills\.map|data\.skills/.test(main));
  });
});
