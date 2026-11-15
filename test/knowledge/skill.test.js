import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SKILL_KINDS, Skill, enabledTitles, sameTitle } from '../../src/knowledge/skill.js';

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

describe('Skill kind', () => {
  it('defaults to a service', () => {
    const s = new Skill({ title: 'Whitening', description: 'Brighter' });
    assert.equal(s.kind, 'service');
  });

  it('accepts every kind and rejects others', () => {
    for (const kind of SKILL_KINDS) assert.equal(skill('Title', 'ok', '', true, { kind }).kind, kind);
    assert.throws(() => skill('Title', 'ok', '', true, { kind: 'blog' }), (e) => e.code === 'skill_kind_invalid');
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
});

describe('enabledTitles', () => {
  it('lists every enabled title, sorted, and skips disabled ones', () => {
    assert.deepEqual(enabledTitles([skill('Zeta', 'ok'), skill('Alpha', 'ok'), skill('Hidden', 'ok', '', false)]), ['Alpha', 'Zeta']);
  });

  it('has no cap: the agent is shown all of them', () => {
    const many = Array.from({ length: 150 }, (_, i) => skill(`Skill ${String(i).padStart(3, '0')}`, 'ok'));
    assert.equal(enabledTitles(many).length, 150);
  });

  it('works with Bangla titles', () => {
    assert.deepEqual(enabledTitles([skill('ফিলিং', 'ok')]), ['ফিলিং']);
  });
});
