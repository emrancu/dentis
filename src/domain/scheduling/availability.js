import { toMinutes, weekdayOf } from '../shared/time.js';

/** Callers cannot book a slot starting sooner than this from now. */
const LEAD_MINUTES = 30;
const PERIODS = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] };

/**
 * Domain service: free (doctor, time) openings on a date.
 * @param {object} p
 * @param {import('./doctor.js').Doctor[]} p.doctors
 * @param {import('./appointment.js').Appointment[]} p.booked appointments already on `date`
 * @param {string} p.date YYYY-MM-DD
 * @param {{date:string,time:string}} p.now clinic-local "now"
 */
export function findOpenings({ doctors, booked, date, now, slotMinutes = 30, period = null, doctorId = null }) {
  if (date < now.date) return [];
  const taken = new Set(booked.filter((a) => a.isActive).map((a) => `${a.doctorId}|${a.slot.slice(11, 16)}`));
  const earliest = date === now.date ? toMinutes(now.time) + LEAD_MINUTES : -1;
  const range = PERIODS[period] ?? null;
  const weekday = weekdayOf(date);
  const openings = [];
  for (const doctor of doctors) {
    if (!doctor.worksOn(weekday) || (doctorId && doctor.id !== doctorId)) continue;
    for (const time of doctor.slotTimes(slotMinutes)) {
      const m = toMinutes(time);
      if (m < earliest || (range && (m < range[0] || m >= range[1])) || taken.has(`${doctor.id}|${time}`)) continue;
      openings.push({ time, doctor });
    }
  }
  return openings.sort((a, b) => a.time.localeCompare(b.time) || a.doctor.id - b.doctor.id);
}
