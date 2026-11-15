import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { SESSION_SECONDS } from '../../src/application/admin-auth.js';
import { ACCESS_KEY, VALID_PHONE, buildWorld, startCall } from '../support/fixtures.js';

let world;
let s;
const code = (c) => (e) => e.code === c;
const turn = (speaker, text) => ({ speaker, text, ts: '2026-11-14T04:00:05.000Z' });

beforeEach(async () => {
  world = await buildWorld();
  s = world.services;
});

describe('AdminAuth', () => {
  it('logs in with the access key and verifies the token it issued', async () => {
    const token = await s.adminAuth.login(ACCESS_KEY);
    assert.equal(await s.adminAuth.verify(token), true);
  });

  it('rejects a wrong, empty or missing key', async () => {
    for (const bad of ['wrong', '', undefined, null, 42]) await assert.rejects(s.adminAuth.login(bad), code('invalid_access_key'));
  });

  it('never accepts any key when no access key is configured', async () => {
    const unconfigured = (await buildWorld()).services;
    unconfigured.adminAuth.accessKey = '';
    await assert.rejects(unconfigured.adminAuth.login(''), code('invalid_access_key'));
  });

  it('rejects empty, malformed and tampered tokens', async () => {
    const token = await s.adminAuth.login(ACCESS_KEY);
    const [expires, signature] = token.split('.');
    for (const bad of [undefined, '', 'abc', `${expires}.`, `${expires}.${'0'.repeat(64)}`, `${Number(expires) + 99999}.${signature}`]) {
      assert.equal(await s.adminAuth.verify(bad), false, String(bad));
    }
  });

  it('expires after the session length', async () => {
    const token = await s.adminAuth.login(ACCESS_KEY);
    world.clock.set(new Date(world.clock.now().getTime() + (SESSION_SECONDS - 5) * 1000).toISOString());
    assert.equal(await s.adminAuth.verify(token), true);
    world.clock.set(new Date(world.clock.now().getTime() + 10 * 1000).toISOString());
    assert.equal(await s.adminAuth.verify(token), false);
  });
});

describe('AdminQueries', () => {
  let started = 0;
  async function makeCall({ turns = [turn('agent', 'hi'), turn('patient', 'hello')], book = false } = {}) {
    world.clock.set(new Date(Date.parse('2026-11-14T04:00:00Z') + started++ * 3 * 60 * 1000).toISOString());
    const callId = await startCall(world);
    if (book) await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'toothache', date: '2026-11-15', time: '11:00' });
    world.clock.set(new Date(world.clock.now().getTime() + 2 * 60 * 1000).toISOString());
    await s.finishCall.execute({ callId, turns, reason: 'hangup' });
    return callId;
  }

  it('lists calls newest first with the extracted caller fields', async () => {
    const a = await makeCall({ book: true });
    const b = await makeCall();
    const { items } = await s.adminQueries.listCalls();
    assert.deepEqual(items.map((i) => i.id), [b, a]);
    const booked = items.find((i) => i.id === a);
    assert.deepEqual([booked.status, booked.patient_name, booked.phone, booked.reason_for_visit, booked.duration_s], ['booked', 'Rahim Uddin', VALID_PHONE, 'toothache', 120]);
  });

  it('filters by status and searches name, phone and reason', async () => {
    await makeCall({ book: true });
    await makeCall();
    assert.equal((await s.adminQueries.listCalls({ status: 'booked' })).items.length, 1);
    assert.equal((await s.adminQueries.listCalls({ q: 'rahim' })).items.length, 1);
    assert.equal((await s.adminQueries.listCalls({ q: '01712' })).items.length, 1);
    assert.equal((await s.adminQueries.listCalls({ q: 'tooth' })).items.length, 1);
    assert.equal((await s.adminQueries.listCalls({ q: 'zzz' })).items.length, 0);
  });

  it('pages results and caps the page size', async () => {
    for (let i = 0; i < 3; i++) await makeCall();
    assert.equal((await s.adminQueries.listCalls({ limit: 2 })).items.length, 2);
    assert.equal((await s.adminQueries.listCalls({ limit: 2, offset: 2 })).items.length, 1);
    assert.equal((await s.adminQueries.listCalls({ limit: 99999 })).items.length, 3);
  });

  it('turns a call left in progress for over 30 minutes into incomplete', async () => {
    const callId = await startCall(world);
    world.clock.set('2026-11-14T04:31:00Z');
    const { items } = await s.adminQueries.listCalls();
    assert.equal(items.find((i) => i.id === callId).status, 'incomplete');
  });

  it('returns the whole call: extraction, ordered transcript, appointment and callbacks', async () => {
    const callId = await makeCall({ book: true, turns: [turn('agent', 'আসসালামু আলাইকুম'), turn('patient', 'আমি অ্যাপয়েন্টমেন্ট চাই')] });
    const d = await s.adminQueries.getCall(callId);
    assert.equal(d.call.status, 'booked');
    assert.equal(d.extraction.outcome, 'booked');
    assert.deepEqual(d.turns.map((t) => [t.speaker, t.text_bn, t.text_en]), [['agent', 'আসসালামু আলাইকুম', null], ['patient', 'আমি অ্যাপয়েন্টমেন্ট চাই', null]]);
    assert.deepEqual([d.appointments[0].slot, d.appointments[0].doctor_name, d.appointments[0].patient_name], ['2026-11-15T11:00', 'Dr. Nusrat Jahan', 'Rahim Uddin']);
    assert.deepEqual(d.callbacks, []);
  });

  it('says not found for an unknown call', async () => {
    await assert.rejects(s.adminQueries.getCall('nope'), code('call_not_found'));
  });

  it('builds the dashboard with a zero-filled 7-day series', async () => {
    await makeCall({ book: true });
    await makeCall();
    const callId = await makeCall({ turns: [] });
    await s.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: 'question' });
    const d = await s.adminQueries.dashboard();
    assert.equal(d.total, 3);
    assert.equal(d.avg_duration_s, 120);
    assert.equal(d.by_status.booked, 1);
    assert.equal(d.per_day.length, 7);
    assert.deepEqual(d.per_day.at(-1), { day: '2026-11-14', count: 3 });
    assert.deepEqual(d.per_day[0], { day: '2026-11-08', count: 0 });
    assert.equal(d.open_callbacks, 1);
    assert.equal(d.upcoming_appointments, 1);
  });

  it('lists appointments with patient and doctor names, and patients', async () => {
    await makeCall({ book: true });
    const { items } = await s.adminQueries.listAppointments({ status: 'booked' });
    assert.equal(typeof items[0].doctor_id, 'number');
    assert.deepEqual([items[0].patient_name, items[0].doctor_name, items[0].status], ['Rahim Uddin', 'Dr. Nusrat Jahan', 'booked']);
    assert.equal((await s.adminQueries.listAppointments({ status: 'cancelled' })).items.length, 0);
    assert.equal((await s.adminQueries.listPatients({ q: 'Rahim' })).items[0].phone, VALID_PHONE);
  });
});

describe('UpdateAppointmentStatus and ResolveCallback', () => {
  it('cancels and completes appointments, rejecting other statuses and repeats', async () => {
    const callId = await startCall(world);
    const a = await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '11:00' });
    const b = await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '12:00' });
    assert.equal((await s.updateAppointmentStatus.execute(a.appointment_id, 'cancelled')).status, 'cancelled');
    assert.equal((await s.updateAppointmentStatus.execute(b.appointment_id, 'completed')).status, 'completed');
    await assert.rejects(s.updateAppointmentStatus.execute(a.appointment_id, 'completed'), code('appointment_not_active'));
    await assert.rejects(s.updateAppointmentStatus.execute(b.appointment_id, 'booked'), code('status_invalid'));
    await assert.rejects(s.updateAppointmentStatus.execute(999, 'cancelled'), code('appointment_not_found'));
  });

  it('a cancelled slot can be booked again', async () => {
    const callId = await startCall(world);
    const a = await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '11:00' });
    await s.updateAppointmentStatus.execute(a.appointment_id, 'cancelled');
    await s.bookAppointment.execute({ callId, patientName: 'Karim Ahmed', phone: '01898765432', reason: 'x', date: '2026-11-15', time: '11:00' });
  });

  it('resolves a callback once', async () => {
    const callId = await startCall(world);
    const { callback_id } = await s.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: 'question' });
    assert.equal((await s.resolveCallback.execute(callback_id)).status, 'resolved');
    await assert.rejects(s.resolveCallback.execute(callback_id), code('callback_already_resolved'));
    await assert.rejects(s.resolveCallback.execute(999), code('callback_not_found'));
    assert.equal((await s.adminQueries.listCallbacks({ status: 'open' })).items.length, 0);
  });
});

describe('SkillCatalog', () => {
  it('creates, updates, disables and deletes', async () => {
    const created = await s.skillCatalog.create({ title: 'Braces', description: 'Straighten teeth', content: 'From 35000 taka' });
    assert.ok(created.id);
    assert.equal(created.updatedAt, world.clock.now().toISOString());
    await s.skillCatalog.update(created.id, { title: 'Braces', description: 'Straighten teeth', content: 'From 40000 taka', enabled: false });
    assert.equal((await world.ports.skills.findById(created.id)).content, 'From 40000 taka');
    await s.skillCatalog.remove(created.id);
    assert.equal(await world.ports.skills.findById(created.id), null);
  });

  it('validates input and reports unknown ids', async () => {
    await assert.rejects(s.skillCatalog.create({ title: '', description: 'x' }), code('skill_title_invalid'));
    await assert.rejects(s.skillCatalog.update(999, { title: 'Ok title', description: 'ok' }), code('skill_not_found'));
    await assert.rejects(s.skillCatalog.remove(999), code('skill_not_found'));
  });
});

describe('DoctorDirectory', () => {
  it('creates and updates a doctor', async () => {
    const d = await s.doctorDirectory.create({ nameEn: 'Dr. Farhana Islam', days: [0, 2], startTime: '15:00', endTime: '20:00' });
    assert.ok(d.id);
    const updated = await s.doctorDirectory.update(d.id, { nameEn: 'Dr. Farhana Islam', specialty: 'Braces', days: [0], startTime: '15:00', endTime: '19:00' });
    assert.equal(updated.specialty, 'Braces');
    assert.equal((await world.ports.doctors.findById(d.id)).endTime, '19:00');
  });

  it('refuses to delete a doctor with appointments but deletes an unused one', async () => {
    const callId = await startCall(world);
    await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'x', date: '2026-11-15', time: '11:00' });
    await assert.rejects(s.doctorDirectory.remove(1), code('doctor_has_appointments'));
    await s.doctorDirectory.remove(2);
    assert.equal(await world.ports.doctors.findById(2), null);
    await assert.rejects(s.doctorDirectory.remove(2), code('doctor_not_found'));
  });

  it('a new doctor can be booked straight away', async () => {
    const callId = await startCall(world);
    await s.doctorDirectory.create({ nameEn: 'Dr. Farhana Islam', days: [0], startTime: '15:00', endTime: '20:00' });
    const r = await s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'braces', date: '2026-11-15', time: '19:30', doctorName: 'Farhana' });
    assert.equal(r.doctor_name_en, 'Dr. Farhana Islam');
  });
});

describe('ClinicService and GetPublicSite', () => {
  it('updates part of the profile and keeps the rest', async () => {
    const p = await s.clinic.update({ phone: '09638-001122' });
    assert.equal(p.phone, '09638-001122');
    assert.equal(p.hours, 'Sat-Thu 10am-8pm');
  });

  it('rejects an invalid profile without saving it', async () => {
    await assert.rejects(s.clinic.update({ slot_minutes: 7 }), code('slot_minutes_invalid'));
    assert.equal((await s.clinic.profile()).slotMinutes, 30);
  });

  it('a longer slot length changes the slots offered', async () => {
    await s.clinic.update({ slot_minutes: 60 });
    const r = await s.checkAvailability.execute({ date: '2026-11-15', doctorName: 'Nusrat' });
    assert.deepEqual(r.slots.slice(0, 3).map((x) => x.time), ['10:00', '11:00', '12:00']);
  });

  it('public site shows active doctors only', async () => {
    const doctor = await world.ports.doctors.findById(2);
    doctor.active = false;
    await world.ports.doctors.save(doctor);
    const site = await s.getPublicSite.execute();
    assert.deepEqual(site.doctors.map((d) => d.name_en), ['Dr. Nusrat Jahan']);
    assert.equal(site.clinic.name_en, 'Dentis Dental Care');
  });
});
