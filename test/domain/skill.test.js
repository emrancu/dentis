import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SKILL_KINDS, Skill, TITLE_INDEX_CAP, rankSkills, sameTitle, titleIndex } from '../../src/domain/skills/skill.js';

const skill = (title, description, content = '', enabled = true, extra = {}) => new Skill({ id: title, title, description, content, enabled, ...extra });

describe('Skill', () => {
  it('trims and defaults', () => {
    const s = new Skill({ title: '  Whitening ', description: ' Brighter smile ' });
    assert.equal(s.title, 'Whitening');
    assert.equal(s.enabled, true);
    assert.equal(s.content, '');
  });

  it('validates title, description and content length', () => {
    assert.throws(() => skill('x', 'ok'), (e) => e.code === 'skill_title_invalid');
    assert.throws(() => skill('Title', ''), (e) => e.code === 'skill_description_invalid');
    assert.throws(() => skill('Title', 'ok', 'x'.repeat(4001)), (e) => e.code === 'skill_content_too_long');
  });
});

describe('Skill kind and keywords', () => {
  it('defaults to a service with no keywords', () => {
    const s = new Skill({ title: 'Whitening', description: 'Brighter' });
    assert.deepEqual([s.kind, s.keywords], ['service', '']);
  });

  it('accepts every kind and rejects others', () => {
    for (const kind of SKILL_KINDS) assert.equal(skill('Title', 'ok', '', true, { kind }).kind, kind);
    assert.throws(() => skill('Title', 'ok', '', true, { kind: 'blog' }), (e) => e.code === 'skill_kind_invalid');
  });

  it('trims keywords and limits them to 300 characters', () => {
    assert.equal(skill('Title', 'ok', '', true, { keywords: '  a, b  ' }).keywords, 'a, b');
    assert.throws(() => skill('Title', 'ok', '', true, { keywords: 'k'.repeat(301) }), (e) => e.code === 'skill_keywords_too_long');
  });

  it('compares titles ignoring case and spaces', () => {
    assert.equal(sameTitle(' Root Canal ', 'root canal'), true);
    assert.equal(sameTitle('Root canal', 'Fillings'), false);
    assert.equal(sameTitle(null, ''), true);
  });
});

describe('Skill in either language', () => {
  it('has no separate Bangla fields', () => {
    const s = new Skill({ title: 'দাঁত তোলা', description: 'ক্ষতিগ্রস্ত দাঁত অপসারণ' });
    assert.equal('titleBn' in s || 'descriptionBn' in s, false);
  });

  it('search finds Bangla text written in the normal fields', () => {
    const list = [
      new Skill({ title: 'Tooth extraction', description: 'Removal of teeth', keywords: 'দাঁত তোলা' }),
      new Skill({ title: 'ফিলিং', description: 'গর্ত ভরাট করা' }),
    ];
    assert.equal(rankSkills(list, 'ফিলিং')[0].title, 'ফিলিং');
    assert.equal(rankSkills(list, 'ভরাট')[0].title, 'ফিলিং');
    assert.equal(rankSkills(list, 'দাঁত তোলা')[0].title, 'Tooth extraction');
  });
});

describe('titleIndex', () => {
  const many = (n, enabled = true) => Array.from({ length: n }, (_, i) => skill(`Skill ${String(i).padStart(3, '0')}`, 'ok', '', enabled));

  it('lists enabled titles sorted', () => {
    const r = titleIndex([skill('Zeta', 'ok'), skill('Alpha', 'ok'), skill('Hidden', 'ok', '', false)]);
    assert.deepEqual(r, { overCap: false, titles: ['Alpha', 'Zeta'] });
  });

  it('lists up to the cap and drops the list past it', () => {
    assert.equal(titleIndex(many(TITLE_INDEX_CAP)).overCap, false);
    assert.equal(titleIndex(many(TITLE_INDEX_CAP)).titles.length, TITLE_INDEX_CAP);
    assert.deepEqual(titleIndex(many(TITLE_INDEX_CAP + 1)), { overCap: true, titles: [] });
  });

  it('does not count disabled skills toward the cap', () => {
    assert.equal(titleIndex([...many(TITLE_INDEX_CAP), ...many(10, false)]).overCap, false);
  });

  it('has a cap of 40', () => {
    assert.equal(TITLE_INDEX_CAP, 40);
  });
});

describe('rankSkills', () => {
  it('finds a skill by its keywords, in Bangla and English', () => {
    const list = [
      skill('Tooth extraction', 'Removal of teeth', 'Fee 1000', true, { keywords: 'wisdom, দাঁত তোলা, আক্কেল দাঁত' }),
      skill('Fillings', 'Cavity repair', 'Fee 1200', true, { keywords: 'ফিলিং, গর্ত' }),
    ];
    assert.equal(rankSkills(list, 'আক্কেল দাঁত')[0].title, 'Tooth extraction');
    assert.equal(rankSkills(list, 'গর্ত হয়েছে')[0].title, 'Fillings');
    assert.equal(rankSkills(list, 'wisdom')[0].title, 'Tooth extraction');
  });

  it('matches Bangla words that carry an ending: the field has the stem, the caller says the inflected form', () => {
    const list = [
      skill('Tooth extraction', 'Removal of teeth', '', true, { keywords: 'দাঁত তোলা' }),
      skill('Treating children', 'Kids', '', true, { keywords: 'শিশু, বাচ্চা' }),
      skill('Parking', 'Where to park', '', true, { keywords: 'গাড়ি' }),
    ];
    assert.equal(rankSkills(list, 'তোলার পর')[0].title, 'Tooth extraction');
    assert.equal(rankSkills(list, 'বাচ্চাদের দেখেন')[0].title, 'Treating children');
    assert.equal(rankSkills(list, 'গাড়িতে এসেছি')[0].title, 'Parking');
  });

  it('does not treat very short field words as stems', () => {
    const list = [skill('Parking', 'Where to park', '', true, { keywords: 'গা' })];
    assert.deepEqual(rankSkills(list, 'গাড়িতে'), []);
  });

  it('weights a keyword above the description and below the title', () => {
    const inTitle = skill('Braces', 'x1', '', true);
    const inKeywords = skill('Alignment', 'x2', '', true, { keywords: 'braces' });
    const inDescription = skill('Orthodontics', 'About braces', '', true);
    assert.deepEqual(rankSkills([inDescription, inKeywords, inTitle], 'braces').map((s) => s.title), ['Braces', 'Alignment', 'Orthodontics']);
  });

  it('ignores filler words that say nothing about the topic', () => {
    const list = [skill('Parking', 'Where to park', 'Behind the building'), skill('Fees', 'What it costs', 'how much is the visit')];
    assert.equal(rankSkills(list, 'how much for the visit')[0].title, 'Fees');
    assert.deepEqual(rankSkills(list, 'how much do you for the'), []);
    assert.deepEqual(rankSkills(list, 'কত কি আছে'), []);
  });

});

describe('rankSkills (basics)', () => {
  const all = [
    skill('Scaling and polishing', 'Teeth cleaning', 'Fee 1500 taka'),
    skill('Root canal treatment', 'Saves an infected tooth', 'Fee 6000 taka'),
    skill('Teeth whitening', 'Brighter smile. দাঁত সাদা করা।', 'Fee 8000 taka'),
    skill('Hidden', 'Draft', 'cleaning fee', false),
  ];

  it('puts the title match first', () => {
    assert.equal(rankSkills(all, 'root canal')[0].title, 'Root canal treatment');
  });

  it('finds a skill by words in its description or details', () => {
    assert.equal(rankSkills(all, 'cleaning')[0].title, 'Scaling and polishing');
    assert.equal(rankSkills(all, '6000')[0].title, 'Root canal treatment');
  });

  it('matches Bangla text', () => {
    assert.equal(rankSkills(all, 'দাঁত সাদা')[0].title, 'Teeth whitening');
  });

  it('never returns disabled skills', () => {
    assert.equal(rankSkills(all, 'draft').length, 0);
  });

  it('returns nothing for an empty or unmatched query and respects the limit', () => {
    assert.deepEqual(rankSkills(all, ''), []);
    assert.deepEqual(rankSkills(all, 'zzzz'), []);
    assert.equal(rankSkills(all, 'fee', 2).length, 2);
  });
});
