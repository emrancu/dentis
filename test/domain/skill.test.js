import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Skill, rankSkills } from '../../src/domain/skills/skill.js';

const skill = (title, description, content = '', enabled = true) => new Skill({ id: title, title, description, content, enabled });

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

describe('rankSkills', () => {
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
