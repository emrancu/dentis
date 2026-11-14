import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { VALID_PHONE, buildWorld, startCall } from '../support/fixtures.js';

let world;
let callId;
let s;
const code = (c) => (e) => e.code === c;

const book = (over = {}) =>
  s.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'toothache', date: '2026-11-15', time: '11:00', ...over });

beforeEach(async () => {
  world = await buildWorld();
  s = world.services;
  callId = await startCall(world);
});

describe('CheckAvailability', () => {
  const check = (args) => s.checkAvailability.execute(args);

  it('returns real free slots with the doctor and the Bangla weekday', async () => {
    const r = await check({ date: '2026-11-15' });
    assert.equal(r.weekday_bn, 'রবিবার');
    assert.equal(r.slots[0].time, '10:00');
    assert.equal(r.slots[0].doctor_name_en, 'Dr. Nusrat Jahan');
    assert.equal(r.slots.length, 8);
  });

  it('says so when the clinic is closed that day', async () => {
    const r = await check({ date: '2026-11-20' }); // Friday
    assert.deepEqual(r.slots, []);
    assert.match(r.message, /another day/);
  });

  it('filters by doctor and by part of the day', async () => {
    const r = await check({ date: '2026-11-16', doctorName: 'Tanvir', period: 'evening' });
    assert.ok(r.slots.length > 0);
    assert.ok(r.slots.every((x) => x.doctor_name_en === 'Dr. Tanvir Rahman' && x.time >= '17:00'));
  });

  it('rejects an unknown doctor and a bad date', async () => {
    await assert.rejects(check({ date: '2026-11-15', doctorName: 'Nobody' }), code('doctor_not_found'));
    await assert.rejects(check({ date: 'next sunday' }), code('date_invalid'));
  });
});

describe('BookAppointment', () => {
  it('books, registers the patient and records the outcome on the call', async () => {
    const r = await book();
    assert.equal(r.slot, '2026-11-15T11:00');
    assert.equal(r.doctor_name_en, 'Dr. Nusrat Jahan');
    assert.equal(r.phone_spoken, '0 1 7 1 2 3 4 5 6 7 8');

    const patient = await world.ports.patients.findByPhone(VALID_PHONE);
    assert.equal(patient.fullName, 'Rahim Uddin');
    const appointment = await world.ports.appointments.findById(r.appointment_id);
    assert.deepEqual([appointment.callId, appointment.patientId, appointment.status], [callId, patient.id, 'booked']);

    const extraction = await world.ports.calls.getExtraction(callId);
    assert.deepEqual([extraction.outcome, extraction.intent, extraction.preferredDatetime], ['booked', 'booking', '2026-11-15T11:00']);
    assert.equal((await world.ports.calls.findById(callId)).patientId, patient.id);
  });

  it('accepts Bangla digits in phone, date and time', async () => {
    const r = await book({ phone: '০১৭১২৩৪৫৬৭৮', date: '২০২৬-১১-১৫', time: '১১:০০' });
    assert.equal(r.slot, '2026-11-15T11:00');
  });

  it('picks the requested doctor', async () => {
    const r = await book({ date: '2026-11-16', time: '15:00', doctorName: 'ডা. তানভীর' });
    assert.equal(r.doctor_name_en, 'Dr. Tanvir Rahman');
  });

  it('reuses the patient when the same number books again', async () => {
    await book();
    await book({ time: '12:00', patientName: 'Someone Else' });
    assert.equal((await world.ports.patients.list()).length, 1);
  });

  it('rejects an invalid phone, name, date or time with a coded error', async () => {
    await assert.rejects(book({ phone: '12345' }), code('phone_invalid'));
    await assert.rejects(book({ patientName: 'R' }), code('name_invalid'));
    await assert.rejects(book({ date: '2026-02-30' }), code('date_invalid'));
    await assert.rejects(book({ time: '25:00' }), code('time_invalid'));
  });

  it('rejects a time in the past and a date too far ahead', async () => {
    await assert.rejects(book({ date: '2026-11-14', time: '09:00' }), code('slot_in_past'));
    await assert.rejects(book({ date: '2026-11-13' }), code('slot_in_past'));
    await assert.rejects(book({ date: '2027-02-01' }), code('slot_too_far'));
  });

  it('rejects an unknown doctor', async () => {
    await assert.rejects(book({ doctorName: 'Nobody' }), code('doctor_not_found'));
  });

  it('does not book the same doctor and slot twice and offers alternatives', async () => {
    await book();
    await assert.rejects(book({ phone: '01898765432', patientName: 'Karim Ahmed' }), (e) => {
      assert.equal(e.code, 'slot_unavailable');
      assert.ok(e.details.alternatives.length > 0);
      assert.ok(e.details.alternatives.every((a) => a.time !== '11:00' || a.doctor_name_en !== 'Dr. Nusrat Jahan'));
      return true;
    });
  });

  it('refuses a time outside the doctor hours', async () => {
    await assert.rejects(book({ time: '21:00' }), code('slot_unavailable'));
    await assert.rejects(book({ time: '11:10' }), code('slot_unavailable'));
  });

  it('refuses a slot on a day the doctor does not work', async () => {
    await assert.rejects(book({ date: '2026-11-20', time: '11:00' }), code('slot_unavailable'));
  });
});

describe('RescheduleAppointment', () => {
  const reschedule = (over = {}) => s.rescheduleAppointment.execute({ callId, phone: VALID_PHONE, newDate: '2026-11-16', newTime: '12:00', ...over });

  it('moves the upcoming appointment and marks the call rescheduled', async () => {
    const booked = await book();
    const r = await reschedule();
    assert.equal(r.appointment_id, booked.appointment_id);
    assert.equal(r.slot, '2026-11-16T12:00');
    assert.equal((await world.ports.appointments.findById(booked.appointment_id)).slot, '2026-11-16T12:00');
    assert.equal((await world.ports.calls.getExtraction(callId)).outcome, 'rescheduled');
  });

  it('frees the old slot', async () => {
    await book();
    await reschedule();
    await book({ phone: '01898765432', patientName: 'Karim Ahmed' });
  });

  it('can move within the same day to a free slot', async () => {
    await book();
    const r = await reschedule({ newDate: '2026-11-15', newTime: '11:30' });
    assert.equal(r.slot, '2026-11-15T11:30');
  });

  it('is unavailable when the new slot is taken', async () => {
    await book();
    await book({ phone: '01898765432', patientName: 'Karim Ahmed', date: '2026-11-16', time: '12:00' });
    await assert.rejects(reschedule(), code('slot_unavailable'));
  });

  it('needs an upcoming appointment for that phone', async () => {
    await assert.rejects(reschedule(), code('appointment_not_found'));
    await book();
    await assert.rejects(reschedule({ phone: '01898765432' }), code('appointment_not_found'));
  });

  it('asks which one when there are several, and takes the old date to choose', async () => {
    const first = await book();
    const second = await book({ date: '2026-11-17', time: '10:00' });
    await assert.rejects(reschedule(), (e) => e.code === 'appointment_ambiguous' && e.details.appointments.length === 2);
    const r = await reschedule({ oldDate: '2026-11-17', newDate: '2026-11-18', newTime: '10:00' });
    assert.equal(r.appointment_id, second.appointment_id);
    assert.equal((await world.ports.appointments.findById(first.appointment_id)).slot, '2026-11-15T11:00');
  });

  it('ignores appointments in the past or already cancelled', async () => {
    const booked = await book();
    const appt = await world.ports.appointments.findById(booked.appointment_id);
    appt.cancel();
    await world.ports.appointments.save(appt);
    await assert.rejects(reschedule(), code('appointment_not_found'));
  });
});

describe('CancelAppointment', () => {
  const cancel = (over = {}) => s.cancelAppointment.execute({ callId, phone: VALID_PHONE, ...over });

  it('cancels and marks the call cancelled', async () => {
    const booked = await book();
    const r = await cancel();
    assert.equal(r.appointment_id, booked.appointment_id);
    assert.equal((await world.ports.appointments.findById(booked.appointment_id)).status, 'cancelled');
    assert.equal((await world.ports.calls.getExtraction(callId)).outcome, 'cancelled');
  });

  it('cannot cancel twice', async () => {
    await book();
    await cancel();
    await assert.rejects(cancel(), code('appointment_not_found'));
  });

  it('rejects a bad phone', async () => {
    await assert.rejects(cancel({ phone: 'x' }), code('phone_invalid'));
  });
});
