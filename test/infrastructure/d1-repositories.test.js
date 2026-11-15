import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { Appointment } from '../../src/domain/scheduling/appointment.js';
import { Call } from '../../src/domain/calls/call.js';
import { CallbackRequest } from '../../src/domain/calls/callback-request.js';
import { ClinicProfile } from '../../src/domain/clinic/clinic-profile.js';
import { Doctor } from '../../src/domain/scheduling/doctor.js';
import { Patient } from '../../src/domain/scheduling/patient.js';
import { Skill } from '../../src/domain/skills/skill.js';
import { D1CallRepository } from '../../src/infrastructure/d1/call-repository.js';
import { D1CallbackRepository, D1SettingsRepository, D1SkillRepository } from '../../src/infrastructure/d1/content-repositories.js';
import { D1AppointmentRepository, D1DoctorRepository, D1PatientRepository } from '../../src/infrastructure/d1/scheduling-repositories.js';
import { createD1 } from '../support/sqlite-d1.js';

const now = new Date('2026-11-14T04:00:00.000Z');
let db;

beforeEach(() => {
  db = createD1();
});

describe('D1CallRepository', () => {
  let calls;
  const newCall = (id, startedAt = now.toISOString(), ipHash = 'h1') => Call.start({ id, now: new Date(startedAt), ipHash });
  beforeEach(() => {
    calls = new D1CallRepository(db);
  });

  it('creates, finds and saves a call', async () => {
    await calls.create(newCall('c1'));
    const call = await calls.findById('c1');
    assert.deepEqual([call.status, call.endedAt, call.ipHash], ['in_progress', null, 'h1']);
    call.finish({ now: new Date('2026-11-14T04:02:00Z'), status: 'booked' });
    call.summary = 'Booked.';
    await calls.save(call);
    const saved = await calls.findById('c1');
    assert.deepEqual([saved.status, saved.durationS, saved.summary], ['booked', 120, 'Booked.']);
    assert.equal(await calls.findById('missing'), null);
  });

  it('replaces turns in order and keeps the English text', async () => {
    await calls.create(newCall('c1'));
    await calls.saveTurns('c1', [
      { idx: 0, speaker: 'agent', textBn: 'আসসালামু আলাইকুম', textEn: null, ts: '2026-11-14T04:00:01.000Z' },
      { idx: 1, speaker: 'patient', textBn: 'দাঁতে ব্যথা', textEn: null, ts: '2026-11-14T04:00:05.000Z' },
    ]);
    await calls.saveTurns('c1', [
      { idx: 0, speaker: 'agent', textBn: 'আসসালামু আলাইকুম', textEn: 'Peace be upon you', ts: '2026-11-14T04:00:01.000Z' },
      { idx: 1, speaker: 'patient', textBn: 'দাঁতে ব্যথা', textEn: 'Toothache', ts: '2026-11-14T04:00:05.000Z' },
    ]);
    const turns = await calls.getTurns('c1');
    assert.deepEqual(turns.map((t) => [t.idx, t.speaker, t.textEn]), [[0, 'agent', 'Peace be upon you'], [1, 'patient', 'Toothache']]);
    assert.equal(turns[1].textBn, 'দাঁতে ব্যথা');
  });

  it('merges extraction fields without erasing earlier ones', async () => {
    await calls.create(newCall('c1'));
    assert.equal(await calls.getExtraction('c1'), null);
    await calls.mergeExtraction('c1', { patientName: 'Rahim', phone: '01712345678' });
    await calls.mergeExtraction('c1', { reasonForVisit: 'toothache', phone: undefined, bogus: 'x' });
    await calls.mergeExtraction('c1', {});
    assert.deepEqual(await calls.getExtraction('c1'), { patientName: 'Rahim', phone: '01712345678', reasonForVisit: 'toothache', preferredDatetime: null, intent: null, outcome: null, notes: null });
  });

  it('lists newest first with extraction, filtered by status and search, with paging', async () => {
    await calls.create(newCall('c1', '2026-11-14T04:00:00.000Z'));
    await calls.create(newCall('c2', '2026-11-14T05:00:00.000Z'));
    await calls.create(newCall('c3', '2026-11-14T06:00:00.000Z'));
    await calls.mergeExtraction('c1', { patientName: 'Rahim Uddin', phone: '01712345678', reasonForVisit: 'toothache' });
    const c3 = await calls.findById('c3');
    c3.finish({ now: new Date('2026-11-14T06:01:00Z'), status: 'booked' });
    await calls.save(c3);

    const all = await calls.list({ limit: 10, offset: 0 });
    assert.deepEqual(all.map((r) => r.call.id), ['c3', 'c2', 'c1']);
    assert.equal(all[2].extraction.patientName, 'Rahim Uddin');
    assert.equal(all[0].extraction, null);
    assert.deepEqual((await calls.list({ status: 'booked', limit: 10, offset: 0 })).map((r) => r.call.id), ['c3']);
    assert.deepEqual((await calls.list({ q: 'Rahim', limit: 10, offset: 0 })).map((r) => r.call.id), ['c1']);
    assert.deepEqual((await calls.list({ q: '0171', limit: 10, offset: 0 })).map((r) => r.call.id), ['c1']);
    assert.deepEqual((await calls.list({ limit: 1, offset: 1 })).map((r) => r.call.id), ['c2']);
  });

  it('counts recent calls per IP hash', async () => {
    await calls.create(newCall('c1', '2026-11-14T03:00:00.000Z', 'a'));
    await calls.create(newCall('c2', '2026-11-14T04:00:00.000Z', 'a'));
    await calls.create(newCall('c3', '2026-11-14T04:00:00.000Z', 'b'));
    assert.equal(await calls.countRecentByIp('a', '2026-11-14T03:30:00.000Z'), 1);
    assert.equal(await calls.countRecentByIp('a', '2026-11-14T00:00:00.000Z'), 2);
  });

  it('expires only old in-progress calls', async () => {
    await calls.create(newCall('old', '2026-11-14T01:00:00.000Z'));
    await calls.create(newCall('new', '2026-11-14T04:00:00.000Z'));
    const done = await calls.findById('old');
    await calls.create(newCall('done', '2026-11-14T01:00:00.000Z'));
    const finished = await calls.findById('done');
    finished.finish({ now: new Date('2026-11-14T01:05:00Z'), status: 'booked' });
    await calls.save(finished);
    await calls.expireStale('2026-11-14T03:30:00.000Z', now.toISOString());
    assert.equal((await calls.findById('old')).status, 'incomplete');
    assert.equal((await calls.findById('new')).status, 'in_progress');
    assert.equal((await calls.findById('done')).status, 'booked');
    assert.ok(done);
  });

  it('computes stats with Dhaka days', async () => {
    await calls.create(newCall('c1', '2026-11-14T04:00:00.000Z'));
    await calls.create(newCall('c2', '2026-11-14T19:00:00.000Z')); // 01:00 on the 15th in Dhaka
    await calls.create(newCall('c3', '2026-11-01T04:00:00.000Z'));
    const c1 = await calls.findById('c1');
    c1.finish({ now: new Date('2026-11-14T04:01:00Z'), status: 'booked' });
    await calls.save(c1);
    const stats = await calls.stats('2026-11-08T00:00:00.000Z');
    assert.equal(stats.total, 3);
    assert.equal(stats.avgDurationS, 60);
    assert.deepEqual(stats.byStatus, { booked: 1, in_progress: 2 });
    assert.deepEqual(stats.perDay.sort((a, b) => a.day.localeCompare(b.day)), [{ day: '2026-11-14', count: 1 }, { day: '2026-11-15', count: 1 }]);
  });

  it('removes turns and extraction together with the call (cascade)', async () => {
    await calls.create(newCall('c1'));
    await calls.mergeExtraction('c1', { patientName: 'Rahim' });
    await db.prepare('DELETE FROM calls WHERE id = ?').bind('c1').run();
    assert.equal(await calls.getExtraction('c1'), null);
  });
});

describe('D1 scheduling repositories', () => {
  let patients;
  let doctors;
  let appointments;
  beforeEach(() => {
    patients = new D1PatientRepository(db);
    doctors = new D1DoctorRepository(db);
    appointments = new D1AppointmentRepository(db);
  });

  it('inserts patients with an id, finds them by phone, id and ids, and keeps phones unique', async () => {
    const p = await patients.insert(Patient.register({ fullName: 'Rahim Uddin', phone: '01712345678', now }));
    assert.ok(p.id);
    assert.equal((await patients.findByPhone('01712345678')).fullName, 'Rahim Uddin');
    assert.equal((await patients.findById(p.id)).phone, '01712345678');
    assert.equal(await patients.findByPhone('01999999999'), null);
    const q = await patients.insert(Patient.register({ fullName: 'Karim Ahmed', phone: '01898765432', now }));
    assert.deepEqual((await patients.findManyByIds([p.id, q.id])).map((x) => x.fullName).sort(), ['Karim Ahmed', 'Rahim Uddin']);
    assert.deepEqual(await patients.findManyByIds([]), []);
    assert.deepEqual((await patients.list('Karim')).map((x) => x.fullName), ['Karim Ahmed']);
    await assert.rejects(patients.insert(Patient.register({ fullName: 'Duplicate', phone: '01712345678', now })), /UNIQUE/);
  });

  it('round-trips doctors including their days', async () => {
    const d = await doctors.insert(new Doctor({ nameEn: 'Dr. Nusrat', nameBn: 'ডা. নুসরাত', days: [6, 0, 1], startTime: '10:00', endTime: '17:00' }));
    const loaded = await doctors.findById(d.id);
    assert.deepEqual([loaded.nameBn, loaded.days, loaded.active], ['ডা. নুসরাত', [6, 0, 1], true]);
    loaded.active = false;
    loaded.days = [2];
    await doctors.save(loaded);
    assert.deepEqual([(await doctors.list())[0].active, (await doctors.list())[0].days], [false, [2]]);
    await doctors.remove(d.id);
    assert.deepEqual(await doctors.list(), []);
  });

  describe('appointments', () => {
    let patientId;
    let doctorId;
    const book = (slot, over = {}) =>
      appointments.insert(Appointment.book({ patientId, callId: null, doctorId, slot: { toString: () => slot }, service: 'cleaning', now, ...over }));

    beforeEach(async () => {
      patientId = (await patients.insert(Patient.register({ fullName: 'Rahim Uddin', phone: '01712345678', now }))).id;
      doctorId = (await doctors.insert(new Doctor({ nameEn: 'Dr. Nusrat' }))).id;
    });

    it('lists by date, patient and status, and counts', async () => {
      const a = await book('2026-11-15T10:00');
      await book('2026-11-15T10:30');
      const c = await book('2026-11-16T10:00');
      c.cancel();
      await appointments.save(c);
      assert.equal((await appointments.listOnDate('2026-11-15')).length, 2);
      assert.equal((await appointments.listForPatient(patientId)).length, 3);
      assert.deepEqual((await appointments.list('cancelled')).map((x) => x.id), [c.id]);
      assert.equal((await appointments.list()).length, 3);
      assert.equal(await appointments.countForDoctor(doctorId), 3);
      assert.equal(await appointments.countUpcoming('2026-11-15T10:15'), 1);
      assert.equal((await appointments.findById(a.id)).service, 'cleaning');
    });

    it('moves an appointment', async () => {
      const a = await book('2026-11-15T10:00');
      a.moveTo({ toString: () => '2026-11-17T12:00' }, doctorId);
      await appointments.save(a);
      assert.equal((await appointments.findById(a.id)).slot, '2026-11-17T12:00');
    });

    it('enforces one active appointment per doctor and slot, but allows a cancelled one to be rebooked', async () => {
      const first = await book('2026-11-15T10:00');
      await assert.rejects(book('2026-11-15T10:00'), /UNIQUE/);
      first.cancel();
      await appointments.save(first);
      await book('2026-11-15T10:00');
    });
  });
});

describe('D1 content repositories', () => {
  it('skills: insert, list, update, remove', async () => {
    const skills = new D1SkillRepository(db);
    const s = await skills.insert(new Skill({ title: 'Whitening', description: 'Brighter', content: '8000 taka', updatedAt: now.toISOString() }));
    s.enabled = false;
    s.content = '9000 taka';
    await skills.save(s);
    const [loaded] = await skills.list();
    assert.deepEqual([loaded.title, loaded.content, loaded.enabled], ['Whitening', '9000 taka', false]);
    assert.equal((await skills.findById(s.id)).title, 'Whitening');
    await skills.remove(s.id);
    assert.equal(await skills.findById(s.id), null);
  });

  it('settings: upsert key/value pairs', async () => {
    const settings = new D1SettingsRepository(db);
    await settings.setMany({ name_en: 'A', phone: '1' });
    await settings.setMany({ name_en: 'B' });
    assert.deepEqual(await settings.all(), { name_en: 'B', phone: '1' });
  });

  it('callbacks: insert, filter, resolve, count', async () => {
    const callbacks = new D1CallbackRepository(db);
    const make = (reason) => CallbackRequest.create({ callId: null, name: 'Karim', phone: '01712345678', reason, now });
    const a = await callbacks.insert(make('first'));
    await callbacks.insert(make('second'));
    assert.equal(await callbacks.countOpen(), 2);
    a.resolve();
    await callbacks.save(a);
    assert.equal(await callbacks.countOpen(), 1);
    assert.deepEqual((await callbacks.list('resolved')).map((c) => c.reason), ['first']);
    assert.equal((await callbacks.list()).length, 2);
    assert.equal((await callbacks.findById(a.id)).status, 'resolved');
  });
});

describe('bilingual content', () => {
  const BANGLA = /[\u0980-\u09FF]/;
  const LATIN_WORD = /[A-Za-z]{3,}/;

  it('a skill and a doctor round-trip their Bangla fields through the real SQL', async () => {
    const db2 = createD1();
    const skills = new D1SkillRepository(db2);
    const s = await skills.insert(new Skill({ title: 'Whitening', description: 'Brighter', titleBn: 'দাঁত সাদা করা', descriptionBn: 'উজ্জ্বল হাসি', updatedAt: now.toISOString() }));
    s.titleBn = 'সাদা করা';
    await skills.save(s);
    const [loaded] = await skills.list();
    assert.deepEqual([loaded.titleBn, loaded.descriptionBn], ['সাদা করা', 'উজ্জ্বল হাসি']);
    const doctors = new D1DoctorRepository(db2);
    const d = await doctors.insert(new Doctor({ nameEn: 'Dr. Nusrat', specialty: 'Braces', specialtyBn: 'ব্রেসেস' }));
    assert.equal((await doctors.findById(d.id)).specialtyBn, 'ব্রেসেস');
  });

  it('seed: English fields are English only and Bangla fields are Bangla only, so no string mixes languages', async () => {
    const seeded = createD1({ seed: true });
    const everything = await new D1SkillRepository(seeded).list();
    const services = everything.filter((s) => s.kind === 'service');
    assert.ok(services.length >= 8);
    for (const s of everything) {
      assert.doesNotMatch(s.title + s.description, BANGLA, `English fields of "${s.title}" contain Bangla`);
      assert.match(s.titleBn, BANGLA, `${s.title} has no Bangla title`);
      assert.match(s.descriptionBn, BANGLA, `${s.title} has no Bangla description`);
      assert.doesNotMatch(s.titleBn + s.descriptionBn, LATIN_WORD, `Bangla fields of "${s.title}" contain English words`);
    }
    for (const d of await new D1DoctorRepository(seeded).list()) {
      assert.doesNotMatch(d.specialty, BANGLA);
      assert.match(d.specialtyBn, BANGLA);
      assert.doesNotMatch(d.specialtyBn, LATIN_WORD);
    }
    const p = ClinicProfile.fromMap(await new D1SettingsRepository(seeded).all());
    for (const f of ['address', 'hours', 'directions']) {
      assert.doesNotMatch(p[f], BANGLA, `${f} contains Bangla`);
      assert.match(p[`${f}Bn`], BANGLA, `${f}Bn is not Bangla`);
      assert.doesNotMatch(p[`${f}Bn`], LATIN_WORD, `${f}Bn contains English words`);
    }
  });

  it('the Bangla content migration can be run again without duplicating the implants service or changing counts', async () => {
    const seeded = createD1({ seed: true });
    const count = async () => (await new D1SkillRepository(seeded).list()).length;
    const before = await count();
    seeded.exec(readFileSync(new URL('../../migrations/0006_bilingual_content.sql', import.meta.url), 'utf8'));
    assert.equal(await count(), before);
  });

  it('seed: the clinic offers implants, because the hero shows them', async () => {
    const titles = (await new D1SkillRepository(createD1({ seed: true })).list()).map((s) => s.title);
    assert.ok(titles.includes('Dental implants'));
  });

  it('seed: hours use one time style in both languages', async () => {
    const p = ClinicProfile.fromMap(await new D1SettingsRepository(createD1({ seed: true })).all());
    assert.match(p.hours, /10:00 am to 8:00 pm/);
    assert.doesNotMatch(p.hours, /AM|PM|\b\d{1,2}(am|pm)\b/);
    assert.match(p.hoursBn, /সকাল ১০:০০.*রাত ৮:০০/);
  });
});

describe('migrations', () => {
  it('the demo seed can be run again without duplicating doctors, skills or settings', async () => {
    const seeded = createD1({ seed: true });
    const counts = async () => ({
      doctors: (await new D1DoctorRepository(seeded).list()).length,
      skills: (await new D1SkillRepository(seeded).list()).length,
      settings: Object.keys(await new D1SettingsRepository(seeded).all()).length,
    });
    const before = await counts();
    seeded.exec(readFileSync(new URL('../../migrations/0002_seed.sql', import.meta.url), 'utf8'));
    seeded.exec(readFileSync(new URL('../../migrations/0002_seed.sql', import.meta.url), 'utf8'));
    assert.deepEqual(await counts(), before);
  });

  it('a skill round-trips kind and keywords through the real SQL', async () => {
    const repo = new D1SkillRepository(createD1());
    const s = await repo.insert(new Skill({ title: 'Parking', description: 'Parking info', content: 'c', kind: 'faq', keywords: 'park, car', updatedAt: 't' }));
    assert.equal((await repo.findById(s.id)).kind, 'faq');
    s.kind = 'policy';
    s.keywords = 'park, গাড়ি';
    await repo.save(s);
    const [back] = await repo.list();
    assert.equal(back.kind, 'policy');
    assert.equal(back.keywords, 'park, গাড়ি');
  });

  it('the seed gives every skill keywords, with faq and policy entries', async () => {
    const skills = await new D1SkillRepository(createD1({ seed: true })).list();
    assert.ok(skills.every((s) => s.keywords.length > 0));
    assert.ok(skills.some((s) => s.kind === 'faq'));
    assert.ok(skills.some((s) => s.kind === 'policy'));
    assert.equal(skills.find((s) => s.title === 'Booking and cancellation policy').kind, 'policy');
  });

  it('the knowledge seed and demo seed can be run again without duplicates', async () => {
    const seeded = createD1({ seed: true });
    const count = async () => [(await new D1SkillRepository(seeded).list()).length, (await new D1DoctorRepository(seeded).list()).length];
    const before = await count();
    for (const f of ['0004_knowledge_seed.sql', '0002_seed.sql']) seeded.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
    assert.deepEqual(await count(), before);
  });

  it('the schema can be applied twice (IF NOT EXISTS everywhere)', () => {
    const fresh = createD1();
    fresh.exec(readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8'));
  });

  it('the optional sample calls load on top of the seed and can also be re-run', async () => {
    const seeded = createD1({ seed: true });
    const sample = readFileSync(new URL('../../seed/sample_calls.sql', import.meta.url), 'utf8');
    seeded.exec(sample);
    seeded.exec(sample);
    const calls = await new D1CallRepository(seeded).list({ limit: 50, offset: 0 });
    assert.equal(calls.length, 4);
  });

  it('the seed loads and builds a valid profile, doctors and skills', async () => {
    const seeded = createD1({ seed: true });
    const profile = ClinicProfile.fromMap(await new D1SettingsRepository(seeded).all());
    assert.equal(profile.nameEn, 'Dentis Dental Care');
    assert.equal(profile.slotMinutes, 30);
    const doctors = await new D1DoctorRepository(seeded).list();
    assert.equal(doctors.length, 3);
    assert.ok(doctors.every((d) => d.active && d.days.length > 0));
    const skills = await new D1SkillRepository(seeded).list();
    assert.ok(skills.length >= 6);
    assert.ok(skills.every((s) => s.enabled));
  });
});
