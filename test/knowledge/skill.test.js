import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Skill, enabledTitles, sameTitle } from '../../src/knowledge/skill.js';

const skill = (title, content = 'Details.', enabled = true) => new Skill({ id: title, title, content, enabled });

describe('Skill', () => {
  it('trims and defaults to enabled', () => {
    const s = new Skill({ title: '  Whitening ', content: ' 8000 taka ' });
    assert.deepEqual([s.title, s.content, s.enabled], ['Whitening', '8000 taka', true]);
  });

  it('is just a title and its details: no description, type or Bangla twins', () => {
    const s = new Skill({ title: 'দাঁত তোলা', content: 'সাধারণ দাঁত তোলা ১০০০ টাকা।', kind: 'faq', description: 'x' });
    assert.deepEqual(Object.keys(s).sort(), ['content', 'enabled', 'id', 'title', 'updatedAt']);
  });

  it('validates the title and the details', () => {
    assert.throws(() => skill('x'), (e) => e.code === 'skill_title_invalid');
    assert.throws(() => skill('Title', ''), (e) => e.code === 'skill_content_required');
    assert.throws(() => skill('Title', '   '), (e) => e.code === 'skill_content_required');
    assert.throws(() => skill('Title', 'x'.repeat(4001)), (e) => e.code === 'skill_content_too_long');
  });

  it('compares titles ignoring case and spaces', () => {
    assert.equal(sameTitle(' Root Canal ', 'root canal'), true);
    assert.equal(sameTitle('Root canal', 'Fillings'), false);
    assert.equal(sameTitle(null, ''), true);
  });
});

describe('enabledTitles', () => {
  it('lists every enabled title, sorted, and skips disabled ones', () => {
    assert.deepEqual(enabledTitles([skill('Zeta'), skill('Alpha'), skill('Hidden', 'x1', false)]), ['Alpha', 'Zeta']);
  });

  it('has no cap: the agent is shown all of them', () => {
    const many = Array.from({ length: 150 }, (_, i) => skill(`Skill ${String(i).padStart(3, '0')}`));
    assert.equal(enabledTitles(many).length, 150);
  });

  it('works with Bangla titles', () => {
    assert.deepEqual(enabledTitles([skill('ফিলিং')]), ['ফিলিং']);
  });
});
