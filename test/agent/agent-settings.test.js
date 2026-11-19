import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_GREETING, MAX_INSTRUCTIONS } from '../../src/agent/agent-prompt.js';
import { buildWorld, promptOf } from '../support/fixtures.js';

let world;
let s;
const code = (c) => (e) => e.code === c;

beforeEach(async () => {
  world = await buildWorld();
  s = world.services;
});

describe('AgentSettings.get', () => {
  it('shows the defaults, with the {clinic} placeholder kept, when nothing is saved', async () => {
    const r = await s.agentSettings.get();
    assert.equal(r.instructions, r.default_instructions);
    assert.equal(r.greeting, r.default_greeting);
    assert.match(r.instructions, /virtual receptionist of \{clinic\}/);
    assert.match(r.greeting, /\{clinic\}-এ আপনাকে স্বাগতম/);
  });
});

describe('AgentSettings.update', () => {
  it('saves new text and returns what the agent will use', async () => {
    const r = await s.agentSettings.update({ instructions: 'Be calm at {clinic}.', greeting: 'Salam from {clinic}.' });
    assert.deepEqual([r.instructions, r.greeting], ['Be calm at {clinic}.', 'Salam from {clinic}.']);
    assert.deepEqual(await world.ports.settings.all().then((m) => [m.agent_instructions, m.agent_greeting]), ['Be calm at {clinic}.', 'Salam from {clinic}.']);
  });

  it('blank text resets to the default and stores nothing', async () => {
    await s.agentSettings.update({ instructions: 'Custom', greeting: 'Custom' });
    const r = await s.agentSettings.update({ instructions: '', greeting: '   ' });
    assert.equal(r.instructions, r.default_instructions);
    assert.equal(r.greeting, r.default_greeting);
    const saved = await world.ports.settings.all();
    assert.deepEqual([saved.agent_instructions, saved.agent_greeting], ['', '']);
  });

  it('text identical to the default is stored as empty, so future default improvements still apply', async () => {
    const { default_instructions: di, default_greeting: dg } = await s.agentSettings.get();
    await s.agentSettings.update({ instructions: `  ${di}  `, greeting: dg });
    const saved = await world.ports.settings.all();
    assert.deepEqual([saved.agent_instructions, saved.agent_greeting], ['', '']);
  });

  it('rejects text over the limits and saves nothing', async () => {
    await assert.rejects(s.agentSettings.update({ instructions: 'x'.repeat(MAX_INSTRUCTIONS + 1), greeting: '' }), code('instructions_too_long'));
    await assert.rejects(s.agentSettings.update({ instructions: '', greeting: 'y'.repeat(MAX_GREETING + 1) }), code('greeting_too_long'));
    assert.equal((await world.ports.settings.all()).agent_instructions, undefined);
  });

  it('does not disturb the clinic profile stored beside it', async () => {
    await s.agentSettings.update({ instructions: 'Hello', greeting: 'Hi' });
    assert.equal((await s.clinic.profile()).hours, 'Sat-Thu 10am-8pm');
    await s.clinic.update({ phone: '123' });
    assert.equal((await s.agentSettings.get()).instructions, 'Hello');
  });
});

describe('AgentSettings.preview', () => {
  it('renders the prompt for unsaved text without saving it', async () => {
    const { prompt } = await s.agentSettings.preview({ instructions: 'Preview persona for {clinic}.', greeting: 'Preview greeting' });
    assert.ok(prompt.startsWith('Preview persona for Dentis Dental Care.'));
    assert.match(prompt, /Greet: "Preview greeting"/);
    assert.equal((await world.ports.settings.all()).agent_instructions, undefined);
  });

  it('blank text previews the defaults, and the preview contains the locked rules, doctors and enabled titles only', async () => {
    const { prompt } = await s.agentSettings.preview({ instructions: '', greeting: '' });
    assert.match(prompt, /colloquial Dhaka Bangla/);
    assert.match(prompt, /Never give medical advice/);
    assert.match(prompt, /Dr\. Tanvir Rahman/);
    assert.match(prompt, /- Scaling and polishing/);
    assert.doesNotMatch(prompt, /Secret draft/);
  });

  it('rejects over-long unsaved text', async () => {
    await assert.rejects(s.agentSettings.preview({ instructions: 'x'.repeat(MAX_INSTRUCTIONS + 1) }), code('instructions_too_long'));
  });
});

describe('an edit reaches the next call', () => {
  it('uses the saved persona and greeting from the next turn', async () => {
    const before = await promptOf(world, { ip: '1.1.1.1' });
    await s.agentSettings.update({ instructions: 'You are Nila at {clinic}.', greeting: 'Salam, Nila here.' });
    const after = await promptOf(world, { ip: '1.1.1.2' });
    assert.ok(after.startsWith('You are Nila at Dentis Dental Care.'));
    assert.match(after, /Greet: "Salam, Nila here\."/);
    assert.match(after, /Never give medical advice/);
    assert.match(before, /virtual receptionist of Dentis Dental Care/);
  });

  it('a reset goes back to the default on the next call', async () => {
    await s.agentSettings.update({ instructions: 'Custom persona', greeting: '' });
    await s.agentSettings.update({ instructions: '', greeting: '' });
    assert.match(await promptOf(world, { ip: '1.1.1.3' }), /virtual receptionist of Dentis Dental Care/);
  });
});
