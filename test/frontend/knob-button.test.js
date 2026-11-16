import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { knobTravel, labelShift } from '../../public/website/js/knob-button.js';

const read = (path) => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
const css = read('website/css/site.css');
const rule = (selector) => new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';

describe('knob travel maths', () => {
  it('travel is the shell width minus the knob and its two insets', () => {
    assert.equal(knobTravel(300, 64, 5), 226);
    assert.equal(knobTravel(214, 64, 5), 140);
    assert.equal(knobTravel(260, 52, 4), 200);
  });

  it('never travels backwards, even for a shell narrower than the knob', () => {
    assert.equal(knobTravel(60, 64, 5), 0);
    assert.equal(knobTravel(0, 64, 5), 0);
  });

  it('the label shifts left by knob + inset + gap − end padding', () => {
    assert.equal(labelShift({ knob: 64, inset: 5, gap: 18, end: 28 }), 59);
    assert.equal(labelShift({ knob: 52, inset: 4, gap: 14, end: 22 }), 48);
  });

  it('at the end of the slide the knob keeps the same inset on the right', () => {
    const shell = 250;
    const left = 5 + knobTravel(shell, 64, 5);
    assert.equal(shell - (left + 64), 5);
  });
});

describe('slide-knob button styles', () => {
  it('uses the specified sizes: height 52, knob 64, inset 5, gap 18, end 28', () => {
    const kb = rule('.kb');
    for (const v of ['--kb-h: 52px', '--kb-knob: 64px', '--kb-inset: 5px', '--kb-gap: 18px', '--kb-end: 28px']) assert.ok(kb.includes(v), v);
    assert.match(kb, /padding: 0 var\(--kb-end\) 0 calc\(var\(--kb-inset\) \+ var\(--kb-knob\) \+ var\(--kb-gap\)\)/);
  });

  it('takes its colours from the site tokens: shell = text colour, label = background, knob = primary gradient', () => {
    const kb = rule('.kb');
    assert.match(kb, /--kb-shell: var\(--ink\)/);
    assert.match(kb, /--kb-label: #fff/);
    assert.match(rule('.kb__knob'), /linear-gradient\(135deg, #17b3a3, var\(--teal-600\)\)/);
    assert.match(rule('.kb__knob'), /color: #fff/);
  });

  it('the shell uses the button radius token, and the knob radius is that radius minus the inset (never negative)', () => {
    assert.match(rule('.kb'), /border-radius: var\(--btn-radius\)/);
    assert.match(rule('.kb__knob'), /border-radius: max\(0px, calc\(var\(--btn-radius\) - var\(--kb-inset\)\)\)/);
  });

  it('the button radius is 4px, defined once, and used by every public button', () => {
    assert.match(css, /--btn-radius: 4px;/);
    for (const sel of ['.kb', '.fab', '.lang-btn', '.menu-btn', '.tx-tab', '.ctl']) assert.match(rule(sel), /border-radius: var\(--btn-radius\)/, sel);
    for (const sel of ['.kb', '.kb__knob', '.fab', '.lang-btn', '.menu-btn', '.tx-tab', '.ctl']) assert.doesNotMatch(rule(sel), /border-radius: (999px|50%|\d+px)/, `${sel} must not set its own radius`);
  });

  it('the shell and the knob stay concentric: with a 4px radius and a 4 or 5px inset the knob has square corners', () => {
    const knobRadius = (radius, inset) => Math.max(0, radius - inset);
    assert.equal(knobRadius(4, 5), 0);
    assert.equal(knobRadius(4, 4), 0);
    assert.equal(knobRadius(12, 5), 7);
  });

  it('animates transform only, for 600ms with cubic-bezier(.76,0,.24,1)', () => {
    assert.match(rule('.kb'), /--kb-ease: cubic-bezier\(0\.76, 0, 0\.24, 1\)/);
    for (const part of ['.kb__knob', '.kb__label']) assert.match(rule(part), /transition: transform 600ms var\(--kb-ease\)/);
    const moving = css.split('\n').filter((l) => /transition:/.test(l) && /kb__/.test(l));
    assert.ok(moving.every((l) => !/left|right|margin|width|padding/.test(l.split('transition:')[1])), 'only transform may animate');
  });

  it('hover and keyboard focus do the same thing: knob to the end, label the other way, at once', () => {
    assert.match(css, /\.kb:hover \.kb__knob, \.kb:focus-visible \.kb__knob \{ transform: translateX\(var\(--kb-travel, 0px\)\); \}/);
    assert.match(css, /\.kb:hover \.kb__label, \.kb:focus-visible \.kb__label \{ transform: translateX\(calc\(-1 \* \(var\(--kb-knob\) \+ var\(--kb-inset\) \+ var\(--kb-gap\) - var\(--kb-end\)\)\)\); \}/);
  });

  it('there is no layout change on hover: only the knob and the label move', () => {
    const hover = css.split('\n').filter((l) => /^\.kb:hover/.test(l));
    assert.ok(hover.length >= 2);
    assert.ok(hover.every((l) => /transform: translateX/.test(l) && !/width|height|padding|margin|left|right/.test(l.replace(/translateX\([^)]*\)/g, ''))));
  });

  it('reduced motion makes it instant', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.kb__knob, \.kb__label \{ transition: none; \} \}/);
  });

  it('has a small variant, a light variant, and respects the hidden attribute', () => {
    assert.match(rule('.kb--sm'), /--kb-h: 44px; --kb-knob: 52px; --kb-inset: 4px; --kb-gap: 14px; --kb-end: 22px/);
    assert.match(rule('.kb--light'), /--kb-shell: #fff; --kb-label: var\(--ink\)/);
    assert.match(css, /\.kb\[hidden\] \{ display: none; \}/);
  });

  it('the floating "Talk to us" button is a solid button: one flat colour, no knob, no sliding', () => {
    const fab = rule('.fab');
    assert.match(fab, /background: var\(--teal-600\)/);
    assert.match(fab, /color: #fff/);
    assert.match(fab, /height: 48px/);
    assert.match(fab, /border-radius: var\(--btn-radius\)/);
    assert.doesNotMatch(fab, /gradient/);
    assert.match(css, /^\.fab:hover \{ background: var\(--teal-700\);/m);
    assert.doesNotMatch(css, /\.fab[^{]*kb__/);
  });

  it('on phones the solid floating button is a 56px square with only the call icon', () => {
    assert.match(css, /\.fab \{ width: 56px; height: 56px; padding: 0; justify-content: center; \}/);
    assert.match(css, /\.fab__label \{ display: none; \}/);
  });

  it('none of the old call-to-action styles is left behind', () => {
    for (const old of ['.btn-call', '.btn-ghost', '.btn-outline', '.ctl-primary', '.fab-label', '@keyframes ping']) assert.ok(!css.includes(old), old);
  });

  it('the page measures the travel at runtime', () => {
    const main = read('website/js/main.js');
    assert.match(main, /import \{ initKnobButtons \} from '\.\/knob-button\.js'/);
    assert.match(main, /initKnobButtons\(\)/);
    assert.match(read('website/js/knob-button.js'), /ResizeObserver/);
  });
});

describe('slide-knob buttons in the page', () => {
  const html = read('index.html');
  const buttons = [...html.matchAll(/<(button|a)\b([^>]*?\bclass="[^"]*\bkb\b[^"]*"[^>]*)>(.*?)<\/\1>/gs)].map((m) => ({ tag: m[1], classes: /class="([^"]*)"/.exec(m[2])[1], attrs: m[2], inner: m[3] }));
  const ARROW_PATH = 'M0 0h2v2H0zM2 2h2v2H2zM4 4h2v2H4zM2 6h2v2H2zM0 8h2v2H0z';

  it('every call-to-action button is a slide-knob button', () => {
    assert.equal(buttons.length, 7);
    const where = (re) => buttons.filter((b) => re.test(b.attrs + b.classes));
    assert.equal(where(/id="book-btn"/).length, 1, 'hero booking button');
    assert.equal(where(/href="#services"/).length, 1, 'hero secondary link');
    assert.equal(where(/btn-book/).length, 1, 'header booking button');
    assert.equal(where(/id="visit-tel"/).length, 1, 'visit phone link');
    assert.equal(where(/data-restart/).length, 2, 'call panel retry and call again');
    assert.equal(where(/data-start-booking/).length, 3, 'hero, header and visit booking');
  });

  it('each one has a knob with its icon, then one label', () => {
    for (const b of buttons) {
      assert.match(b.inner, /^<span class="kb__knob" aria-hidden="true">.*?<\/span><span class="kb__label" data-i18n="[A-Za-z.]+">[^<]+<\/span>$/s, b.classes + b.attrs);
      assert.equal(b.inner.split('class="kb__label"').length, 2, 'exactly one label');
    }
  });

  it('the arrow is the fixed pixel chevron on every slide-knob button', () => {
    const arrows = [...html.matchAll(/<svg class="kb__arrow"([^>]*)><path([^>]*)\/><\/svg>/g)];
    assert.equal(arrows.length, buttons.length);
    for (const a of arrows) {
      assert.match(a[1], /viewBox="0 0 6 10" width="9" height="15" aria-hidden="true"/);
      assert.ok(a[2].includes('fill="currentColor"') && a[2].includes(`d="${ARROW_PATH}"`));
    }
  });

  it('the chevron really is five squares on a 3 by 5 grid, drawn from the specified points', () => {
    const squares = [...ARROW_PATH.matchAll(/M(\d+) (\d+)h2v2H\d+z/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.deepEqual(squares, [[0, 0], [2, 2], [4, 4], [2, 6], [0, 8]]); // (0,0)(1,1)(2,2)(1,3)(0,4) at 2 units per cell
  });

  it('the floating "Talk to us" button is a solid button with the call icon and a label, and keeps its accessible name', () => {
    const fab = /<button class="fab" id="fab-call"([^>]*)>(.*?)<\/button>/s.exec(html);
    assert.ok(fab, 'the floating button is a plain .fab, not a knob button');
    assert.match(fab[1], /aria-label=/);
    assert.match(fab[2], /^<svg class="fab__icon" aria-hidden="true"[^>]*>.*<\/svg><span class="fab__label" data-i18n="fab\.label">[^<]+<\/span>$/s);
    assert.doesNotMatch(fab[2], /kb__|arrow/);
    assert.ok(!buttons.some((b) => /fab-call/.test(b.attrs)));
  });

  it('utility controls keep their own style: language toggle, menu, mute, end call, close and the hero tabs', () => {
    for (const id of ['lang-btn', 'menu-btn', 'mute-btn', 'end-btn']) assert.match(html, new RegExp(`id="${id}"[^>]*>`));
    for (const id of ['lang-btn', 'menu-btn', 'mute-btn', 'end-btn']) assert.doesNotMatch(new RegExp(`<[^>]*id="${id}"[^>]*>`).exec(html)[0], /\bkb\b/);
    assert.match(html, /class="tx-tab"/);
  });

  it('the labels still come from the dictionary, so both languages work', async () => {
    const { STRINGS } = await import('../../public/website/js/i18n.js');
    for (const b of buttons) {
      const key = /data-i18n="([^"]+)"/.exec(b.inner)[1];
      assert.ok(STRINGS.en[key] && STRINGS.bn[key], key);
    }
  });
});

describe('call panel buttons', () => {
  it('the text buttons are exactly as tall as the small knob button beside them, in Bangla too', () => {
    const kbHeight = css.match(/\.kb--sm \{[^}]*--kb-h: (\d+)px/)[1];
    const ctl = css.match(/\.call-actions \.ctl \{([^}]*)\}/)[1];
    assert.match(ctl, new RegExp(`height: ${kbHeight}px`));
    assert.match(ctl, /line-height: 1;/, 'the Bangla line-height must not make it taller');
    assert.match(ctl, /padding-block: 0/);
  });
});
