import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { knobTravel, labelShift } from '../../public/js/knob-button.js';

const read = (path) => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
const css = read('css/site.css');
const rule = (selector) => new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

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

  it('the knob radius is the shell radius minus the inset', () => {
    assert.match(rule('.kb'), /border-radius: calc\(var\(--kb-h\) \/ 2\)/);
    assert.match(rule('.kb__knob'), /border-radius: calc\(var\(--kb-h\) \/ 2 - var\(--kb-inset\)\)/);
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

  it('on phones the floating button is a circle with a phone icon and does not slide', () => {
    assert.match(css, /\.fab\.kb \{ width: 56px; height: 56px; padding: 0; border-radius: 50%; \}/);
    assert.match(css, /\.fab \.kb__arrow \{ display: none; \}/);
    assert.match(css, /\.fab \.kb__phone \{ display: block; \}/);
    assert.match(css, /\.fab:hover \.kb__knob, \.fab:focus-visible \.kb__knob \{ transform: none; \}/);
  });

  it('none of the old call-to-action styles is left behind', () => {
    for (const old of ['.btn-call', '.btn-ghost', '.btn-outline', '.ctl-primary', '.fab-label', '@keyframes ping']) assert.ok(!css.includes(old), old);
  });

  it('the page measures the travel at runtime', () => {
    const main = read('js/main.js');
    assert.match(main, /import \{ initKnobButtons \} from '\.\/knob-button\.js'/);
    assert.match(main, /initKnobButtons\(\)/);
    assert.match(read('js/knob-button.js'), /ResizeObserver/);
  });
});
