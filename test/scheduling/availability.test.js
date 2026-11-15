import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Appointment } from '../../src/scheduling/appointment.js';
import { Doctor } from '../../src/scheduling/doctor.js';
import { findOpenings } from '../../src/scheduling/availability.js';

const nusrat = new Doctor({ id: 1, nameEn: 'Nusrat', days: [6, 0], startTime: '10:00', endTime: '13:00' });
const tanvir = new Doctor({ id: 2, nameEn: 'Tanvir', days: [0], startTime: '15:00', endTime: '19:00' });
const now = { date: '2026-11-14', time: '10:00' }; // Saturday
const sunday = '2026-11-15';
const times = (openings) => openings.map((o) => `${o.time}/${o.doctor.id}`);
const booked = (doctorId, slot, status = 'booked') => new Appointment({ id: 9, patientId: 1, doctorId, slot, status });

describe('findOpenings', () => {
  it('lists every slot of every working doctor, sorted by time', () => {
    const result = findOpenings({ doctors: [tanvir, nusrat], booked: [], date: sunday, now });
    assert.deepEqual(times(result).slice(0, 3), ['10:00/1', '10:30/1', '11:00/1']);
    assert.equal(result.length, 6 + 8);
  });

  it('is empty on a day nobody works', () => {
    assert.deepEqual(findOpenings({ doctors: [nusrat, tanvir], booked: [], date: '2026-11-20', now }), []);
  });

  it('is empty for a past date', () => {
    assert.deepEqual(findOpenings({ doctors: [nusrat], booked: [], date: '2026-11-13', now }), []);
  });

  it('skips slots that are booked, but not cancelled ones', () => {
    const result = findOpenings({
      doctors: [nusrat],
      booked: [booked(1, `${sunday}T10:00`), booked(1, `${sunday}T10:30`, 'cancelled')],
      date: sunday,
      now,
    });
    assert.equal(times(result).includes('10:00/1'), false);
    assert.equal(times(result).includes('10:30/1'), true);
  });

  it('does not offer slots starting within 30 minutes of now on the same day', () => {
    const result = findOpenings({ doctors: [nusrat], booked: [], date: now.date, now: { date: now.date, time: '10:20' } });
    assert.equal(result[0].time, '11:00');
  });

  it('filters by part of the day', () => {
    const morning = findOpenings({ doctors: [nusrat, tanvir], booked: [], date: sunday, now, period: 'morning' });
    const evening = findOpenings({ doctors: [nusrat, tanvir], booked: [], date: sunday, now, period: 'evening' });
    assert.ok(morning.every((o) => o.time < '12:00'));
    assert.ok(evening.every((o) => o.time >= '17:00'));
    assert.ok(evening.length > 0);
  });

  it('filters by doctor and honours the slot length', () => {
    const result = findOpenings({ doctors: [nusrat, tanvir], booked: [], date: sunday, now, doctorId: 2, slotMinutes: 60 });
    assert.deepEqual(times(result), ['15:00/2', '16:00/2', '17:00/2', '18:00/2']);
  });
});
