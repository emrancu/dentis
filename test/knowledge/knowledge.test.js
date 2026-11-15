import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { buildWorld, startCall } from '../support/fixtures.js';

let world;
let s;
let callId;
const code = (c) => (e) => e.code === c;
const run = (name, args = {}) => s.toolExecutor.execute(name, args, callId);
const add = (input) => s.skillCatalog.create({ content: 'Details.', ...input });

beforeEach(async () => {
  world = await buildWorld();
  s = world.services;
  callId = await startCall(world);
});

describe('get_skill', () => {
  it('returns the full details for an exact title, ignoring case and extra spaces', async () => {
    const r = await run('get_skill', { title: '  root CANAL treatment ' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.skill, { title: 'Root canal treatment', content: 'Fee: 6000 to 12000 taka.' });
  });

  it('fails with a code and guidance for an unknown title', async () => {
    const r = await run('get_skill', { title: 'Nope' });
    assert.deepEqual([r.ok, r.error], [false, 'skill_not_found']);
    assert.match(r.message, /hand over to a human/);
    assert.equal((await run('get_skill')).ok, false);
  });

  it('never returns a disabled skill', async () => {
    assert.equal((await run('get_skill', { title: 'Secret draft' })).ok, false);
  });

  it('works for FAQs and policies as well as services', async () => {
    await add({ title: 'Where to park', content: 'Behind the building.' });
    await add({ title: 'Cancellation policy', content: '4 hours notice.' });
    assert.equal((await run('get_skill', { title: 'where to park' })).skill.content, 'Behind the building.');
    assert.equal((await run('get_skill', { title: 'Cancellation policy' })).skill.content, '4 hours notice.');
  });

  it('shows an edit made in admin on the very next call', async () => {
    await s.skillCatalog.update(1, { title: 'Scaling and polishing', content: 'Fee: 1800 taka.' });
    assert.equal((await run('get_skill', { title: 'Scaling and polishing' })).skill.content, 'Fee: 1800 taka.');
  });
});

describe('Bangla text', () => {
  it('an entry written in Bangla is returned as written', async () => {
    await s.skillCatalog.update(1, { title: 'স্কেলিং ও পলিশিং', content: 'খরচ ১৫০০ টাকা।' });
    const got = (await run('get_skill', { title: 'স্কেলিং ও পলিশিং' })).skill;
    assert.deepEqual(got, { title: 'স্কেলিং ও পলিশিং', content: 'খরচ ১৫০০ টাকা।' });
  });

  it('the public site carries the Bangla specialty of doctors and the Bangla clinic fields', async () => {
    await s.doctorDirectory.update(1, { nameEn: 'Dr. Nusrat Jahan', nameBn: 'ডা. নুসরাত জাহান', specialty: 'General', specialtyBn: 'সাধারণ সেবা', days: [6], startTime: '10:00', endTime: '17:00' });
    await s.clinic.update({ address_bn: 'ধানমন্ডি', hours_bn: 'শনি–বৃহ' });
    const site = await s.getPublicSite.execute();
    assert.equal(site.doctors[0].specialty_bn, 'সাধারণ সেবা');
    assert.deepEqual([site.clinic.address_bn, site.clinic.hours_bn], ['ধানমন্ডি', 'শনি–বৃহ']);
  });
});

describe('SkillCatalog titles and details', () => {
  it('needs details: an entry with only a title is refused', async () => {
    await assert.rejects(s.skillCatalog.create({ title: 'Only a title' }), code('skill_content_required'));
  });

  it('refuses a duplicate title, ignoring case, on create and on update', async () => {
    await assert.rejects(add({ title: ' scaling AND polishing ' }), code('skill_title_taken'));
    await assert.rejects(s.skillCatalog.update(2, { title: 'Scaling and polishing', content: 'x1' }), code('skill_title_taken'));
  });

  it('lets a skill keep its own title when it is edited', async () => {
    const updated = await s.skillCatalog.update(1, { title: 'Scaling and polishing', content: 'New details.' });
    assert.equal(updated.content, 'New details.');
  });

  it('allows a title again after the other skill was deleted', async () => {
    await s.skillCatalog.remove(1);
    await add({ title: 'Scaling and polishing' });
  });
});

describe('what the website and the agent see', () => {
  it('the public site carries no agent knowledge at all', async () => {
    await add({ title: 'Where to park' });
    const site = await s.getPublicSite.execute();
    assert.deepEqual(Object.keys(site).sort(), ['clinic', 'doctors']);
  });

  it('the agent sees every entry in the prompt and can fetch it', async () => {
    await add({ title: 'Where to park' });
    assert.equal((await run('get_skill', { title: 'Where to park' })).ok, true);
    await startCall(world, '2.2.2.2');
    assert.match(world.ports.gateway.sessions.at(-1).instructions, /- Where to park/);
  });

  it('every enabled title is in the prompt however many there are', async () => {
    for (let i = 0; i < 60; i++) await add({ title: `Extra topic ${String(i).padStart(2, '0')}` });
    await startCall(world, '3.3.3.3');
    const prompt = world.ports.gateway.sessions.at(-1).instructions;
    assert.match(prompt, /- Extra topic 00/);
    assert.match(prompt, /- Extra topic 59/);
  });
});
