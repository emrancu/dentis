import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AgentPrompt, DEFAULT_GREETING, DEFAULT_INSTRUCTIONS, MAX_GREETING, MAX_INSTRUCTIONS } from '../../src/agent/agent-prompt.js';

describe('AgentPrompt', () => {
  it('uses the defaults when nothing is saved', () => {
    const r = new AgentPrompt().resolve('Dentis Dental Care');
    assert.match(r.instructions, /virtual receptionist of Dentis Dental Care/);
    assert.match(r.instructions, /colloquial Dhaka Bangla/);
    assert.match(r.greeting, /^আসসালামু আলাইকুম, Dentis Dental Care-এ/);
    assert.ok(!r.instructions.includes('{clinic}') && !r.greeting.includes('{clinic}'));
  });

  it('treats blank and whitespace-only text as "use the default"', () => {
    for (const blank of ['', '   ', '\n\t', null, undefined]) {
      const p = new AgentPrompt({ instructions: blank, greeting: blank });
      assert.equal(p.instructions, '');
      assert.equal(p.resolve('X').instructions, new AgentPrompt().resolve('X').instructions);
    }
  });

  it('uses saved text instead of the default, trimmed', () => {
    const r = new AgentPrompt({ instructions: '  Be brief and kind to {clinic} patients.  ', greeting: ' Salam from {clinic}! ' }).resolve('Dentis');
    assert.equal(r.instructions, 'Be brief and kind to Dentis patients.');
    assert.equal(r.greeting, 'Salam from Dentis!');
  });

  it('replaces every {clinic}, and is safe with characters that are special in replacements', () => {
    const r = new AgentPrompt({ instructions: '{clinic} and {clinic} again, {other} stays' }).resolve('A $& B $1');
    assert.equal(r.instructions, 'A $& B $1 and A $& B $1 again, {other} stays');
  });

  it('enforces the length limits with coded errors', () => {
    assert.doesNotThrow(() => new AgentPrompt({ instructions: 'x'.repeat(MAX_INSTRUCTIONS), greeting: 'y'.repeat(MAX_GREETING) }));
    assert.throws(() => new AgentPrompt({ instructions: 'x'.repeat(MAX_INSTRUCTIONS + 1) }), (e) => e.code === 'instructions_too_long');
    assert.throws(() => new AgentPrompt({ greeting: 'y'.repeat(MAX_GREETING + 1) }), (e) => e.code === 'greeting_too_long');
  });

  it('round-trips through the settings keys', () => {
    const p = new AgentPrompt({ instructions: 'Hello', greeting: 'Hi', closing: 'Bye' });
    assert.deepEqual(p.toSettings(), { agent_instructions: 'Hello', agent_greeting: 'Hi', agent_closing: 'Bye' });
    assert.deepEqual(AgentPrompt.fromSettings(p.toSettings()), p);
    assert.deepEqual(AgentPrompt.fromSettings({}).toSettings(), { agent_instructions: '', agent_greeting: '', agent_closing: '' });
  });

  it('is immutable', () => {
    assert.throws(() => { 'use strict'; new AgentPrompt().instructions = 'x'; });
  });

  it('the defaults themselves stay within the limits', () => {
    assert.ok(DEFAULT_INSTRUCTIONS.length <= MAX_INSTRUCTIONS);
    assert.ok(DEFAULT_GREETING.length <= MAX_GREETING);
  });
});
