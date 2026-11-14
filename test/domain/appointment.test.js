import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Appointment } from '../../src/domain/scheduling/appointment.js';
import { Slot } from '../../src/domain/scheduling/slot.js';

const make = () => Appointment.book({ patientId: 1, callId: 'c1', doctorId: 2, slot: Slot.of('2026-11-16', '18:00'), service: 'cleaning', now: new Date('2026-11-14T04:00:00Z') });

describe('Appointment', () => {
  it('starts booked and exposes date and time', () => {
    const a = make();
    assert.equal(a.status, 'booked');
    assert.equal(a.isActive, true);
    assert.equal(a.date, '2026-11-16');
    assert.equal(a.time, '18:00');
  });

  it('can be cancelled once', () => {
    const a = make();
    a.cancel();
    assert.equal(a.status, 'cancelled');
    assert.throws(() => a.cancel(), (e) => e.code === 'appointment_not_active');
  });

  it('can be completed, but not after cancelling', () => {
    const done = make();
    done.complete();
    assert.equal(done.status, 'completed');
    const cancelled = make();
    cancelled.cancel();
    assert.throws(() => cancelled.complete(), (e) => e.code === 'appointment_not_active');
  });

  it('moves to a new slot and doctor', () => {
    const a = make();
    a.moveTo(Slot.of('2026-11-17', '10:30'), 5);
    assert.equal(a.slot, '2026-11-17T10:30');
    assert.equal(a.doctorId, 5);
  });

  it('cannot move once cancelled', () => {
    const a = make();
    a.cancel();
    assert.throws(() => a.moveTo(Slot.of('2026-11-17', '10:30')), (e) => e.code === 'appointment_not_active');
  });
});
