import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rankSkills } from '../../src/domain/skills/skill.js';
import { D1SkillRepository } from '../../src/infrastructure/d1/content-repositories.js';
import { createD1 } from '../support/sqlite-d1.js';

/**
 * Retrieval eval: how things callers really say (Bangla, English, mixed) find the right knowledge entry.
 * Runs the real demo seed through the real SQL and the real ranking. The target is in agentic-hub/epics/knowledge.md:
 * the expected entry must be in the top 3 for at least 90 percent of the phrasings.
 */
const TARGET = 0.9;

const CASES = [
  // [what the caller says, expected title]
  ['আমার দাঁতে গর্ত হয়েছে', 'Fillings'],
  ['I have a cavity', 'Fillings'],
  ['ফিলিং করার পর কী করব', 'Fillings'],
  ['দাঁত পরিষ্কার করতে কত টাকা লাগে?', 'Scaling and polishing'],
  ['teeth cleaning price', 'Scaling and polishing'],
  ['scaling korte koto lage', 'Scaling and polishing'],
  ['দাঁতের ক্লিনিং', 'Scaling and polishing'],
  ['দাঁতে হলুদ দাগ, সাদা করা যায়?', 'Teeth whitening'],
  ['do you do whitening?', 'Teeth whitening'],
  ['আক্কেল দাঁত তুলতে চাই', 'Tooth extraction'],
  ['how much to remove a tooth', 'Tooth extraction'],
  ['দাঁত তোলার পর কত দিনে ভালো হয়', 'Tooth extraction'],
  ['রুট ক্যানেল করতে কত খরচ', 'Root canal treatment'],
  ['my tooth nerve is infected', 'Root canal treatment'],
  ['ব্রেসেস লাগাতে চাই', 'Braces and aligners'],
  ['my teeth are crooked', 'Braces and aligners'],
  ['প্রথম ভিজিটে চেকআপ কত টাকা', 'Check-up and consultation'],
  ['I want a checkup', 'Check-up and consultation'],
  ['গাড়ি রাখার জায়গা আছে?', 'Where to park'],
  ['is there parking', 'Where to park'],
  ['বাচ্চাদের দাঁত দেখান?', 'Treating children'],
  ['do you treat kids', 'Treating children'],
  ['প্রথম ভিজিটে কী নিয়ে আসব?', 'What to bring on your first visit'],
  ['what should I bring for my first appointment', 'What to bring on your first visit'],
  ['রাতে দাঁতে খুব ব্যথা, কী করব?', 'Emergency and after-hours pain'],
  ['urgent tooth pain after hours', 'Emergency and after-hours pain'],
  ['ইনজেকশন দিলে কি ব্যথা লাগে?', 'Pain during treatment'],
  ['will it hurt during the treatment', 'Pain during treatment'],
  ['অ্যাপয়েন্টমেন্ট বাতিল করতে চাই', 'Booking and cancellation policy'],
  ['can I pay by bkash', 'Booking and cancellation policy'],
  ['I will be late, what happens', 'Booking and cancellation policy'],
  ['ডাক্তার appointment cancel করব', 'Booking and cancellation policy'],
];

async function runEval() {
  const skills = await new D1SkillRepository(createD1({ seed: true })).list();
  return CASES.map(([query, expected]) => {
    const ranked = rankSkills(skills, query).map((s) => s.title);
    return { query, expected, ranked, inTop3: ranked.includes(expected), first: ranked[0] === expected };
  });
}

describe('retrieval eval on the demo knowledge base', () => {
  it('has enough phrasings in both languages to mean something', () => {
    assert.ok(CASES.length >= 30);
    assert.ok(CASES.filter(([q]) => /[ঀ-৿]/.test(q)).length >= 15, 'at least 15 Bangla phrasings');
    assert.ok(CASES.filter(([q]) => !/[ঀ-৿]/.test(q)).length >= 8, 'at least 8 English phrasings');
  });

  it(`finds the expected entry in the top 3 for at least ${TARGET * 100} percent of phrasings`, async () => {
    const results = await runEval();
    const hits = results.filter((r) => r.inTop3).length;
    const misses = results.filter((r) => !r.inTop3).map((r) => `  "${r.query}" expected "${r.expected}", got [${r.ranked.join(' | ')}]`);
    assert.ok(hits / results.length >= TARGET, `top-3 ${hits}/${results.length} is below ${TARGET * 100}%. Misses:\n${misses.join('\n')}`);
  });

  it('puts the expected entry first for most phrasings', async () => {
    const results = await runEval();
    const first = results.filter((r) => r.first).length;
    assert.ok(first / results.length >= 0.7, `top-1 ${first}/${results.length} is below 70%`);
  });

  it('every demo entry is reachable by at least one phrasing', async () => {
    const skills = await new D1SkillRepository(createD1({ seed: true })).list();
    const reachable = new Set(CASES.map(([, expected]) => expected));
    assert.deepEqual(skills.map((s) => s.title).filter((t) => !reachable.has(t)), []);
  });
});
