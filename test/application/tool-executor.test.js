import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { AGENT_TOOLS } from '../../src/application/agent/tools.js';
import { VALID_PHONE, buildWorld, startCall } from '../support/fixtures.js';

let world;
let exec;
let callId;
const run = (name, args = {}) => exec.execute(name, args, callId);

beforeEach(async () => {
  world = await buildWorld();
  exec = world.services.toolExecutor;
  callId = await startCall(world);
});

describe('tool definitions', () => {
  it('every tool sent to the model has a handler, and every handler is sent to the model', () => {
    assert.deepEqual(AGENT_TOOLS.map((t) => t.name).sort(), exec.toolNames.sort());
  });

  it('each definition is a valid function tool with required fields declared as properties', () => {
    for (const t of AGENT_TOOLS) {
      assert.equal(t.type, 'function');
      assert.ok(t.description.length > 20, t.name);
      assert.equal(t.parameters.type, 'object');
      for (const r of t.parameters.required) assert.ok(r in t.parameters.properties, `${t.name}.${r}`);
    }
  });
});

describe('ToolExecutor results', () => {
  it('get_current_datetime reports Dhaka time', async () => {
    assert.deepEqual(await run('get_current_datetime'), { ok: true, date: '2026-11-14', time: '10:00', weekday_en: 'Saturday', weekday_bn: 'শনিবার' });
  });

  it('get_clinic_info returns the clinic profile', async () => {
    const r = await run('get_clinic_info');
    assert.equal(r.name_en, 'Dentis Dental Care');
    assert.equal(r.hours, 'Sat-Thu 10am-8pm');
    assert.equal(r.address, 'Dhanmondi, Dhaka');
  });

  it('list_doctors returns active doctors only', async () => {
    const doctor = await world.ports.doctors.findById(2);
    doctor.active = false;
    await world.ports.doctors.save(doctor);
    const r = await run('list_doctors');
    assert.deepEqual(r.doctors.map((d) => d.name_en), ['Dr. Nusrat Jahan']);
  });

  it('list_skills shows enabled skills without their details', async () => {
    const r = await run('list_skills');
    assert.deepEqual(r.skills.map((s) => s.title), ['Scaling and polishing', 'Root canal treatment']);
    assert.equal('content' in r.skills[0], false);
  });

  it('lookup_skill returns details for the best match and found:false otherwise', async () => {
    const hit = await run('lookup_skill', { query: 'root canal fee' });
    assert.equal(hit.found, true);
    assert.equal(hit.skills[0].content, 'Fee: 6000 to 12000 taka.');
    const miss = await run('lookup_skill', { query: 'helicopter rides' });
    assert.deepEqual([miss.ok, miss.found, miss.skills], [true, false, []]);
  });

  it('lookup_skill never leaks a disabled skill', async () => {
    assert.equal((await run('lookup_skill', { query: 'secret draft hidden' })).found, false);
  });

  it('a skill edited in admin is what the agent says next', async () => {
    await world.services.skillCatalog.update(1, { title: 'Scaling and polishing', description: 'Cleaning', content: 'Fee: 1800 taka.' });
    assert.equal((await run('lookup_skill', { query: 'scaling' })).skills[0].content, 'Fee: 1800 taka.');
  });

  it('check_availability, book_appointment and save_patient_details work through the tool names and snake_case args', async () => {
    const free = await run('check_availability', { date: '2026-11-15', doctor_name: 'Nusrat' });
    assert.equal(free.ok, true);
    const booked = await run('book_appointment', { patient_name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'toothache', date: '2026-11-15', time: '10:30', doctor_name: 'Nusrat' });
    assert.equal(booked.ok, true);
    assert.equal(booked.slot, '2026-11-15T10:30');
    const saved = await run('save_patient_details', { notes: 'prefers evening', intent: 'booking' });
    assert.deepEqual(saved, { ok: true, saved: ['intent', 'notes'] });
  });

  it('reschedule_appointment and cancel_appointment work through the tool names', async () => {
    await run('book_appointment', { patient_name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '10:30' });
    assert.equal((await run('reschedule_appointment', { phone: VALID_PHONE, new_date: '2026-11-16', new_time: '11:00' })).slot, '2026-11-16T11:00');
    assert.equal((await run('cancel_appointment', { phone: VALID_PHONE })).ok, true);
  });

  it('request_human_callback and end_call work', async () => {
    assert.equal((await run('request_human_callback', { name: 'Karim', phone: VALID_PHONE, reason: 'Needs a doctor to call' })).ok, true);
    assert.deepEqual(await run('end_call'), { ok: true });
  });

  it('domain failures come back as ok:false with a code, guidance and details, not as exceptions', async () => {
    const bad = await run('book_appointment', { patient_name: 'Rahim', phone: '123', reason: 'x', date: '2026-11-15', time: '10:30' });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'phone_invalid');
    assert.match(bad.message, /digit by digit/);

    await run('book_appointment', { patient_name: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '10:30' });
    const taken = await run('book_appointment', { patient_name: 'Karim Ahmed', phone: '01898765432', reason: 'x', date: '2026-11-15', time: '10:30', doctor_name: 'Nusrat' });
    assert.equal(taken.error, 'slot_unavailable');
    assert.ok(taken.alternatives.length > 0);
  });

  it('missing or odd arguments never crash the executor', async () => {
    assert.equal((await run('book_appointment')).ok, false);
    assert.equal((await exec.execute('check_availability', null, callId)).ok, false);
    assert.equal((await run('lookup_skill', { query: undefined })).found, false);
  });
});

describe('ToolExecutor guards', () => {
  it('unknown tool and unknown call are errors, not tool results', async () => {
    await assert.rejects(exec.execute('hack', {}, callId), (e) => e.code === 'unknown_tool');
    await assert.rejects(exec.execute('end_call', {}, 'no-such-call'), (e) => e.code === 'call_not_found');
  });

  it('refuses tools once the call has finished', async () => {
    await world.services.finishCall.execute({ callId, turns: [], reason: 'hangup' });
    await assert.rejects(run('end_call'), (e) => e.code === 'call_finished');
  });
});
