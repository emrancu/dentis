import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createApp } from '../../src/app.js';
import { ACCESS_KEY, VALID_PHONE, buildWorld } from '../support/fixtures.js';

let world;
let app;
let waiting;

const request = (method, path, { body, headers = {}, raw } = {}) =>
  app.handle(
    new Request(`https://dentis.test${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) }),
    { waitUntil: (p) => waiting.push(p) },
  );

async function login() {
  const res = await request('POST', '/api/admin/login', { body: { access_key: ACCESS_KEY } });
  return res.headers.get('Set-Cookie').split(';')[0];
}

/** Runs one turn over HTTP on the latest call and returns the system prompt the brain saw. */
async function promptSeen(intent, callId = 'call-1') {
  const res = await request('POST', '/api/agent/turn', { body: { call_id: callId, messages: [{ role: 'user', content: 'হ্যালো' }], intent } });
  await res.text();
  return world.ports.brain.requests.at(-1).messages[0].content;
}

const asAdmin = (cookie) => ({ Cookie: cookie, 'X-Requested-With': 'dentis' });

beforeEach(async () => {
  world = await buildWorld();
  app = createApp(world.services);
  waiting = [];
});

describe('public API', () => {
  it('GET /api/public/site returns the clinic and doctors, and no agent knowledge', async () => {
    const res = await request('GET', '/api/public/site');
    assert.equal(res.status, 200);
    const site = await res.json();
    assert.equal(site.clinic.name_en, 'Dentis Dental Care');
    assert.equal('skills' in site, false);
    assert.equal(site.doctors.length, 2);
  });

  it('POST /api/session starts a call and returns only a one-use listen URL', async () => {
    const res = await request('POST', '/api/session', { headers: { 'CF-Connecting-IP': '203.0.113.5' } });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { call_id: 'call-1', listen_url: 'wss://stt.test/realtime?token=sutkn_test', max_seconds: 300, greeting: 'আসসালামু আলাইকুম, Dentis Dental Care-এ আপনাকে স্বাগতম। আমি কীভাবে আপনাকে সাহায্য করতে পারি?', closing: 'কল করার জন্য আপনাকে ধন্যবাদ। আপনার দিনটি ভালো কাটুক। আল্লাহ হাফেজ।' });
  });

  it('POST /api/agent/turn takes the intent per turn: booking only when asked', async () => {
    await request('POST', '/api/session');
    assert.match(await promptSeen('booking'), /pressed "Book an appointment"/);
    assert.doesNotMatch(await promptSeen(), /pressed "Book an appointment"/);
    assert.doesNotMatch(await promptSeen('hack'), /pressed "Book an appointment"/);
  });

  it('POST /api/session answers 429 when an IP asks too often', async () => {
    for (let i = 0; i < 10; i++) await request('POST', '/api/session', { headers: { 'CF-Connecting-IP': '9.9.9.9' } });
    const res = await request('POST', '/api/session', { headers: { 'CF-Connecting-IP': '9.9.9.9' } });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error.code, 'rate_limited');
  });

  it('POST /api/session answers 500 without details when the voice provider fails', async () => {
    world.ports.voice.fail = true;
    const res = await request('POST', '/api/session');
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: { code: 'internal_error', message: 'Something went wrong.' } });
  });

  it('POST /api/session answers 503 not_configured when an API key is missing', async () => {
    world.ports.brain.configured = false;
    const res = await request('POST', '/api/session');
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, 'not_configured');
  });

  it('runs an agent tool and returns its result', async () => {
    await request('POST', '/api/session');
    const res = await request('POST', '/api/agent/tools/get_clinic_info', { body: { call_id: 'call-1', args: {} } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).name_en, 'Dentis Dental Care');
  });

  it('returns a tool failure as 200 ok:false so the model can recover', async () => {
    await request('POST', '/api/session');
    const res = await request('POST', '/api/agent/tools/book_appointment', { body: { call_id: 'call-1', args: { phone: '1' } } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, false);
  });

  it('answers 404 for an unknown tool or call and 400 for bad JSON', async () => {
    await request('POST', '/api/session');
    assert.equal((await request('POST', '/api/agent/tools/hack', { body: { call_id: 'call-1' } })).status, 404);
    assert.equal((await request('POST', '/api/agent/tools/end_call', { body: { call_id: 'nope' } })).status, 404);
    const bad = await request('POST', '/api/agent/tools/end_call', { raw: '{oops', headers: { 'Content-Type': 'application/json' } });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'invalid_json');
  });

  it('books through the tool route and the booking appears in the portal data', async () => {
    await request('POST', '/api/session');
    const args = { patient_name: 'Rahim Uddin', phone: '০১৭১২৩৪৫৬৭৮', reason: 'toothache', date: '2026-11-15', time: '11:00' };
    const booked = await (await request('POST', '/api/agent/tools/book_appointment', { body: { call_id: 'call-1', args } })).json();
    assert.equal(booked.ok, true);

    const finish = await request('POST', '/api/calls/call-1/finish', {
      body: { reason: 'hangup', turns: [{ speaker: 'agent', text: 'আসসালামু আলাইকুম', ts: '2026-11-14T04:00:01Z' }, { speaker: 'patient', text: 'অ্যাপয়েন্টমেন্ট চাই', ts: '2026-11-14T04:00:05Z' }] },
    });
    assert.deepEqual(await finish.json(), { status: 'booked' });
    await Promise.all(waiting);

    const cookie = await login();
    const detail = await (await request('GET', '/api/admin/calls/call-1', { headers: asAdmin(cookie) })).json();
    assert.equal(detail.call.status, 'booked');
    assert.equal(detail.extraction.phone, VALID_PHONE);
    assert.equal(detail.turns.length, 2);
    assert.equal(detail.turns[0].text_bn, 'আসসালামু আলাইকুম');
    assert.equal(detail.appointments[0].slot, '2026-11-15T11:00');
  });

  it('finish answers 404 for an unknown call', async () => {
    assert.equal((await request('POST', '/api/calls/nope/finish', { body: { turns: [] } })).status, 404);
  });

  it('answers 404 JSON for an unknown path and for the wrong method', async () => {
    assert.equal((await request('GET', '/api/nothing')).status, 404);
    assert.equal((await request('GET', '/api/session')).status, 404);
  });
});

describe('admin authentication', () => {
  it('rejects every admin route without a cookie', async () => {
    for (const [method, path] of [['GET', '/api/admin/me'], ['GET', '/api/admin/dashboard'], ['GET', '/api/admin/calls'], ['GET', '/api/admin/skills'], ['PUT', '/api/admin/settings'], ['GET', '/api/admin/calls/x']]) {
      const res = await request(method, path);
      assert.equal(res.status, 401, `${method} ${path}`);
      assert.equal((await res.json()).error.code, 'unauthorized');
    }
  });

  it('rejects a wrong access key', async () => {
    const res = await request('POST', '/api/admin/login', { body: { access_key: 'nope' } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'invalid_access_key');
    assert.equal(res.headers.get('Set-Cookie'), null);
  });

  it('sets a hardened cookie on login that works for later requests', async () => {
    const res = await request('POST', '/api/admin/login', { body: { access_key: ACCESS_KEY } });
    assert.equal(res.status, 204);
    const cookie = res.headers.get('Set-Cookie');
    assert.match(cookie, /^dentis_admin=\d+\.[0-9a-f]{64};/);
    for (const flag of ['HttpOnly', 'SameSite=Strict', 'Path=/api', 'Secure', 'Max-Age=43200']) assert.ok(cookie.includes(flag), flag);
    const me = await request('GET', '/api/admin/me', { headers: { Cookie: cookie.split(';')[0] } });
    assert.deepEqual(await me.json(), { authenticated: true });
  });

  it('rejects a forged or expired cookie', async () => {
    assert.equal((await request('GET', '/api/admin/me', { headers: { Cookie: 'dentis_admin=9999999999.abc' } })).status, 401);
    const cookie = await login();
    world.clock.set('2026-11-15T05:00:00Z');
    assert.equal((await request('GET', '/api/admin/me', { headers: { Cookie: cookie } })).status, 401);
  });

  it('requires the X-Requested-With header on state-changing calls', async () => {
    const cookie = await login();
    const res = await request('POST', '/api/admin/skills', { body: { title: 'Braces', content: 'x1' }, headers: { Cookie: cookie } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'csrf_rejected');
  });

  it('logout clears the cookie', async () => {
    const cookie = await login();
    const res = await request('POST', '/api/admin/logout', { headers: asAdmin(cookie) });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('Set-Cookie'), /Max-Age=0/);
  });
});

describe('admin API', () => {
  let h;
  beforeEach(async () => {
    h = asAdmin(await login());
  });

  it('skills CRUD, and the next call uses the edit', async () => {
    const created = await request('POST', '/api/admin/skills', { body: { title: 'Braces', content: 'From 35000 taka' }, headers: h });
    assert.equal(created.status, 201);
    const skill = await created.json();
    assert.deepEqual([skill.title, skill.enabled], ['Braces', true]);

    const list = await (await request('GET', '/api/admin/skills', { headers: h })).json();
    assert.equal(list.items.length, 4);

    const updated = await request('PUT', `/api/admin/skills/${skill.id}`, { body: { title: 'Braces', content: 'From 40000 taka' }, headers: h });
    assert.equal((await updated.json()).content, 'From 40000 taka');

    await request('POST', '/api/session');
    const instructions = await promptSeen();
    assert.match(instructions, /- Braces/);
    const fetched = await (await request('POST', '/api/agent/tools/get_skill', { body: { call_id: 'call-1', args: { title: 'Braces' } } })).json();
    assert.equal(fetched.skill.content, 'From 40000 taka');

    assert.equal((await request('DELETE', `/api/admin/skills/${skill.id}`, { headers: h })).status, 204);
    assert.equal((await request('DELETE', `/api/admin/skills/${skill.id}`, { headers: h })).status, 404);
  });

  it('answers 400 for an invalid skill', async () => {
    const res = await request('POST', '/api/admin/skills', { body: { title: '' }, headers: h });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'skill_title_invalid');
  });

  it('doctors CRUD with snake_case fields, and 409 when a doctor has appointments', async () => {
    const created = await request('POST', '/api/admin/doctors', { body: { name_en: 'Dr. Farhana Islam', name_bn: 'ডা. ফারহানা ইসলাম', specialty: 'Braces', days: [0, 2], start_time: '15:00', end_time: '20:00' }, headers: h });
    assert.equal(created.status, 201);
    const doctor = await created.json();
    assert.deepEqual([doctor.name_en, doctor.start_time, doctor.active], ['Dr. Farhana Islam', '15:00', true]);

    const updated = await request('PUT', `/api/admin/doctors/${doctor.id}`, { body: { name_en: 'Dr. Farhana Islam', days: [0], start_time: '16:00', end_time: '20:00', active: false }, headers: h });
    assert.deepEqual([(await updated.json()).start_time], ['16:00']);

    await request('POST', '/api/session');
    await request('POST', '/api/agent/tools/book_appointment', { body: { call_id: 'call-1', args: { patient_name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '11:00' } } });
    const blocked = await request('DELETE', '/api/admin/doctors/1', { headers: h });
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json()).error.code, 'doctor_has_appointments');
    assert.equal((await request('DELETE', `/api/admin/doctors/${doctor.id}`, { headers: h })).status, 204);
    assert.equal((await request('GET', '/api/admin/doctors', { headers: h }).then((r) => r.json())).items.length, 2);
  });

  it('settings read and partial update', async () => {
    const put = await request('PUT', '/api/admin/settings', { body: { phone: '09638-001122', slot_minutes: 45 }, headers: h });
    const profile = await put.json();
    assert.deepEqual([profile.phone, profile.slot_minutes, profile.name_en], ['09638-001122', 45, 'Dentis Dental Care']);
    assert.equal((await (await request('GET', '/api/admin/settings', { headers: h })).json()).slot_minutes, 45);
    assert.equal((await request('PUT', '/api/admin/settings', { body: { slot_minutes: 7 }, headers: h })).status, 400);
  });

  it('dashboard, calls, appointments, patients and callbacks', async () => {
    await request('POST', '/api/session');
    await request('POST', '/api/agent/tools/book_appointment', { body: { call_id: 'call-1', args: { patient_name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '11:00' } } });
    await request('POST', '/api/agent/tools/request_human_callback', { body: { call_id: 'call-1', args: { name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'Wants a doctor call' } } });
    await request('POST', '/api/calls/call-1/finish', { body: { reason: 'hangup', turns: [] } });

    const dash = await (await request('GET', '/api/admin/dashboard', { headers: h })).json();
    assert.deepEqual([dash.total, dash.open_callbacks, dash.upcoming_appointments], [1, 1, 1]);

    const calls = await (await request('GET', '/api/admin/calls?status=booked&q=rahim', { headers: h })).json();
    assert.equal(calls.items.length, 1);

    const appts = await (await request('GET', '/api/admin/appointments', { headers: h })).json();
    const cancelled = await request('PATCH', `/api/admin/appointments/${appts.items[0].id}`, { body: { status: 'cancelled' }, headers: h });
    assert.equal((await cancelled.json()).status, 'cancelled');
    assert.equal((await request('PATCH', `/api/admin/appointments/${appts.items[0].id}`, { body: { status: 'completed' }, headers: h })).status, 409);

    assert.equal((await (await request('GET', '/api/admin/patients', { headers: h })).json()).items.length, 1);

    const callbacks = await (await request('GET', '/api/admin/callbacks?status=open', { headers: h })).json();
    const resolved = await request('PATCH', `/api/admin/callbacks/${callbacks.items[0].id}/resolve`, { headers: h });
    assert.equal((await resolved.json()).status, 'resolved');
    assert.equal((await request('PATCH', '/api/admin/callbacks/999/resolve', { headers: h })).status, 404);
  });

  it('404 for an unknown call', async () => {
    assert.equal((await request('GET', '/api/admin/calls/nope', { headers: h })).status, 404);
  });

  it('a skill is a title and its details, and duplicate titles are refused', async () => {
    const created = await request('POST', '/api/admin/skills', { body: { title: 'Where to park', content: 'Behind the building.' }, headers: h });
    assert.equal(created.status, 201);
    const skill = await created.json();
    assert.deepEqual(Object.keys(skill).sort(), ['content', 'enabled', 'id', 'title', 'updated_at']);

    const list = await (await request('GET', '/api/admin/skills', { headers: h })).json();
    assert.equal('title_index_cap' in list, false);

    const dup = await request('POST', '/api/admin/skills', { body: { title: ' where TO park ', content: 'again' }, headers: h });
    assert.equal(dup.status, 409);
    assert.equal((await dup.json()).error.code, 'skill_title_taken');

    const noDetails = await request('POST', '/api/admin/skills', { body: { title: 'Odd one' }, headers: h });
    assert.equal(noDetails.status, 400);
    assert.equal((await noDetails.json()).error.code, 'skill_content_required');
  });

  it('an FAQ added in admin is answered by the agent through get_skill on the next call', async () => {
    await request('POST', '/api/admin/skills', { body: { title: 'Where to park', content: 'Behind the building.' }, headers: h });
    await request('POST', '/api/session');
    assert.match(await promptSeen(), /- Where to park/);
    const answer = await (await request('POST', '/api/agent/tools/get_skill', { body: { call_id: 'call-1', args: { title: 'Where to park' } } })).json();
    assert.deepEqual([answer.ok, answer.skill.content], [true, 'Behind the building.']);
  });
});

describe('admin doctors', () => {
  let h;
  beforeEach(async () => {
    h = asAdmin(await login());
  });

  it('saves degree, gender and experience through the admin API and returns them', async () => {
    const created = await (await request('POST', '/api/admin/doctors', { headers: h, body: { name_en: 'Dr. Sadia Karim', degree: 'BDS, MDS', degree_bn: 'বিডিএস', gender: 'female', experience_years: 6, days: [0], start_time: '10:00', end_time: '12:00' } })).json();
    assert.deepEqual([created.degree, created.degree_bn, created.gender, created.experience_years], ['BDS, MDS', 'বিডিএস', 'female', 6]);
    const updated = await (await request('PUT', `/api/admin/doctors/${created.id}`, { headers: h, body: { name_en: 'Dr. Sadia Karim', gender: 'male', experience_years: null, days: [0], start_time: '10:00', end_time: '12:00' } })).json();
    assert.deepEqual([updated.gender, updated.experience_years, updated.degree], ['male', null, '']);
    const bad = await request('POST', '/api/admin/doctors', { headers: h, body: { name_en: 'Dr. X', gender: 'robot', days: [0], start_time: '10:00', end_time: '12:00' } });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'doctor_gender_invalid');
  });
});

describe('admin agent prompt', () => {
  let h;
  beforeEach(async () => {
    h = asAdmin(await login());
  });

  it('requires a login, like every admin route', async () => {
    assert.equal((await request('GET', '/api/admin/agent')).status, 401);
    assert.equal((await request('PUT', '/api/admin/agent', { body: {} })).status, 401);
    assert.equal((await request('POST', '/api/admin/agent/preview', { body: {} })).status, 401);
  });

  it('shows the default text with its defaults', async () => {
    const r = await (await request('GET', '/api/admin/agent', { headers: h })).json();
    assert.deepEqual(Object.keys(r).sort(), ['closing', 'default_closing', 'default_greeting', 'default_instructions', 'greeting', 'instructions']);
    assert.equal(r.instructions, r.default_instructions);
    assert.match(r.instructions, /\{clinic\}/);
  });

  it('a saved greeting and closing are returned to the next call and the closing is in the prompt', async () => {
    const saved = await request('PUT', '/api/admin/agent', { body: { instructions: '', greeting: 'Salam from {clinic}.', closing: 'Dhonnobad for calling {clinic}.' }, headers: h });
    assert.equal(saved.status, 200);
    const session = await (await request('POST', '/api/session', { headers: { 'CF-Connecting-IP': '203.0.113.9' } })).json();
    assert.equal(session.greeting, 'Salam from Dentis Dental Care.');
    assert.equal(session.closing, 'Dhonnobad for calling Dentis Dental Care.');
    const prompt = await promptSeen(undefined, session.call_id);
    assert.match(prompt, /Dhonnobad for calling Dentis Dental Care\./);
    assert.match(prompt, /exactly the phone_spoken text/);
  });

  it('saves the text, and the next call uses it while keeping the locked rules', async () => {
    const saved = await request('PUT', '/api/admin/agent', { body: { instructions: 'You are Nila at {clinic}.', greeting: 'Salam, Nila here.' }, headers: h });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).instructions, 'You are Nila at {clinic}.');
    await request('POST', '/api/session');
    const prompt = await promptSeen();
    assert.ok(prompt.startsWith('You are Nila at Dentis Dental Care.'));
    assert.match(prompt, /Greet: "Salam, Nila here\."/);
    assert.match(prompt, /Never give medical advice/);
  });

  it('blank text resets to the default', async () => {
    await request('PUT', '/api/admin/agent', { body: { instructions: 'Custom', greeting: 'Custom' }, headers: h });
    const r = await (await request('PUT', '/api/admin/agent', { body: { instructions: '', greeting: '' }, headers: h })).json();
    assert.equal(r.instructions, r.default_instructions);
    assert.equal(r.greeting, r.default_greeting);
  });

  it('rejects over-long text with 400 and a code, and keeps the old text', async () => {
    const long = await request('PUT', '/api/admin/agent', { body: { instructions: 'x'.repeat(4001), greeting: '' }, headers: h });
    assert.equal(long.status, 400);
    assert.equal((await long.json()).error.code, 'instructions_too_long');
    const greet = await request('PUT', '/api/admin/agent', { body: { instructions: '', greeting: 'y'.repeat(301) }, headers: h });
    assert.equal((await greet.json()).error.code, 'greeting_too_long');
    assert.equal((await (await request('GET', '/api/admin/agent', { headers: h })).json()).instructions.length > 0, true);
  });

  it('previews unsaved text without saving it', async () => {
    const r = await request('POST', '/api/admin/agent/preview', { body: { instructions: 'Preview for {clinic}', greeting: 'Preview hello' }, headers: h });
    assert.equal(r.status, 200);
    const { prompt } = await r.json();
    assert.ok(prompt.startsWith('Preview for Dentis Dental Care'));
    assert.match(prompt, /Greet: "Preview hello"/);
    assert.match(prompt, /# Rules that always apply/);
    const current = await (await request('GET', '/api/admin/agent', { headers: h })).json();
    assert.equal(current.instructions, current.default_instructions);
  });

  it('needs the X-Requested-With header to save, like other admin writes', async () => {
    const cookie = h.Cookie;
    const res = await request('PUT', '/api/admin/agent', { body: { instructions: 'x', greeting: 'y' }, headers: { Cookie: cookie } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'csrf_rejected');
  });

  it('Bangla fields round-trip through doctors and settings, and reach the public site', async () => {
    const doctor = await (await request('PUT', '/api/admin/doctors/1', { body: { name_en: 'Dr. Nusrat Jahan', name_bn: 'ডা. নুসরাত জাহান', specialty: 'General', specialty_bn: 'সাধারণ সেবা', days: [6, 0], start_time: '10:00', end_time: '17:00' }, headers: h })).json();
    assert.equal(doctor.specialty_bn, 'সাধারণ সেবা');

    const settings = await (await request('PUT', '/api/admin/settings', { body: { hours_bn: 'শনি–বৃহ', address_bn: 'ধানমন্ডি', directions_bn: 'লেকের পাশে' }, headers: h })).json();
    assert.deepEqual([settings.hours_bn, settings.address_bn, settings.directions_bn], ['শনি–বৃহ', 'ধানমন্ডি', 'লেকের পাশে']);

    const site = await (await request('GET', '/api/public/site')).json();
    assert.equal(site.doctors.find((d) => d.id === 1).specialty_bn, 'সাধারণ সেবা');
    assert.equal(site.clinic.hours_bn, 'শনি–বৃহ');
  });

  it('agent knowledge is one plain form: Bangla text goes in the same fields', async () => {
    const skill = await (await request('POST', '/api/admin/skills', { body: { title: 'ইমপ্ল্যান্ট', content: 'খরচ ৬০০০০ টাকা' }, headers: h })).json();
    assert.deepEqual([skill.title, skill.content], ['ইমপ্ল্যান্ট', 'খরচ ৬০০০০ টাকা']);
  });
});
