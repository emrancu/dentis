import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { chip, empty, head, rerender } from '../ui.js';

const dhakaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
const shiftDate = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toClock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const clock12 = (hhmm) => `${Number(hhmm.slice(0, 2)) % 12 || 12}:${hhmm.slice(3, 5)} ${Number(hhmm.slice(0, 2)) < 12 ? 'am' : 'pm'}`;
let scheduleDate = null;

export async function scheduleView(view) {
  scheduleDate ??= dhakaToday();
  const [{ items: doctors }, { items: appointments }, clinic] = await Promise.all([api('GET', '/doctors'), api('GET', '/appointments'), api('GET', '/settings')]);
  const date = scheduleDate;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const step = Number(clinic.slot_minutes) || 30;
  const working = doctors.filter((d) => d.active && d.days.includes(weekday));
  const off = doctors.filter((d) => d.active && !d.days.includes(weekday));
  const booked = new Map(); // "doctorId|HH:MM" -> appointment
  for (const a of appointments) if (a.slot.startsWith(date) && a.status !== 'cancelled') booked.set(`${a.doctor_id}|${a.slot.slice(11, 16)}`, a);
  const first = working.length ? Math.min(...working.map((d) => toMinutes(d.start_time))) : 0;
  const last = working.length ? Math.max(...working.map((d) => toMinutes(d.end_time))) : 0;
  const rows = [];
  for (let m = first; m + step <= last; m += step) rows.push(m);
  const open = (d, m) => m >= toMinutes(d.start_time) && m + step <= toMinutes(d.end_time);
  const total = rows.reduce((n, m) => n + working.filter((d) => open(d, m)).length, 0);
  const taken = [...booked.keys()].filter((k) => working.some((d) => String(d.id) === k.split('|')[0])).length;
  const long = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));

  const cell = (d, m) => {
    if (!open(d, m)) return '<td class="slot-off" aria-label="Not working"></td>';
    const a = booked.get(`${d.id}|${toClock(m)}`);
    if (!a) return '<td class="slot-free"><span>Free</span></td>';
    return `<td class="slot-booked ${esc(a.status)}"><strong class="bn">${esc(a.patient_name ?? 'Patient')}</strong><span>${esc(a.phone ?? '')}</span>${a.service ? `<span>${esc(a.service)}</span>` : ''}<span>${chip(a.status)}${a.call_id ? ` <a href="#/calls/${esc(a.call_id)}">Call</a>` : ''}</span></td>`;
  };

  view.innerHTML = `${head('Schedule', 'Every doctor, every slot, one day at a time')}
    <div class="toolbar sched-bar">
      <button class="btn" id="prev" type="button" aria-label="Previous day">‹</button>
      <input type="date" id="pick" value="${date}" aria-label="Choose a day">
      <button class="btn" id="next" type="button" aria-label="Next day">›</button>
      <button class="btn" id="today" type="button" ${date === dhakaToday() ? 'disabled' : ''}>Today</button>
      <strong class="sched-date">${esc(long)}</strong>
      <span class="muted">${taken} booked · ${Math.max(total - taken, 0)} free</span>
    </div>
    ${working.length
      ? `<div class="table-wrap"><table class="sched"><thead><tr><th>Time</th>${working.map((d) => `<th>${esc(d.name_en)}<small>${esc(clock12(d.start_time))} – ${esc(clock12(d.end_time))}</small></th>`).join('')}</tr></thead><tbody>${rows.map((m) => `<tr><th scope="row">${esc(clock12(toClock(m)))}</th>${working.map((d) => cell(d, m)).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<div class="table-wrap">${empty('No doctor works on this day.')}</div>`}
    ${off.length && working.length ? `<p class="muted" style="margin-top:12px">Not working today: ${off.map((d) => esc(d.name_en)).join(', ')}.</p>` : ''}`;
  const go = (iso) => { scheduleDate = iso; rerender(); };
  view.querySelector('#prev').onclick = () => go(shiftDate(date, -1));
  view.querySelector('#next').onclick = () => go(shiftDate(date, 1));
  view.querySelector('#today').onclick = () => go(dhakaToday());
  view.querySelector('#pick').onchange = (e) => e.target.value && go(e.target.value);
}
