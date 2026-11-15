import { esc, formatSlot } from '../../../shared/util.js';
import { api } from '../api.js';
import { chip, confirmDialog, empty, guard, head, rerender, toast } from '../ui.js';

export async function appointmentsView(view) {
  const { items } = await api('GET', '/appointments');
  view.innerHTML = `${head('Appointments', 'Bookings made by the receptionist')}${
    items.length
      ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Status</th><th></th></tr></thead><tbody>${items
          .map((a) => `<tr><td>${esc(formatSlot(a.slot))}</td><td><strong class="bn">${esc(a.patient_name)}</strong><br><span class="muted">${esc(a.phone)}</span></td><td>${esc(a.doctor_name)}</td><td>${esc(a.service || '–')}</td><td>${chip(a.status)}</td><td>${a.status === 'booked' ? `<button class="btn btn-small" data-act="completed" data-id="${a.id}">Mark done</button> <button class="btn btn-small btn-danger" data-act="cancelled" data-id="${a.id}">Cancel</button>` : a.call_id ? `<a href="#/calls/${esc(a.call_id)}">Call</a>` : ''}</td></tr>`)
          .join('')}</tbody></table></div>`
      : `<div class="table-wrap">${empty('No appointments yet. Make a call from the website.')}</div>`
  }`;
  const byId = new Map(items.map((a) => [String(a.id), a]));
  view.querySelectorAll('[data-act]').forEach((b) => (b.onclick = guard(async () => {
    const a = byId.get(b.dataset.id);
    const done = b.dataset.act === 'completed';
    const who = `${a.patient_name} on ${formatSlot(a.slot)}`;
    const ok = await confirmDialog({
      title: done ? 'Mark this appointment as done?' : 'Cancel this appointment?',
      text: done ? `${who} will be marked as completed.` : `${who} will be cancelled and the slot becomes free again. This cannot be undone.`,
      confirm: done ? 'Mark done' : 'Cancel appointment',
      cancel: done ? 'Not yet' : 'Keep it',
      danger: !done,
    });
    if (!ok) return;
    await api('PATCH', `/appointments/${b.dataset.id}`, { status: b.dataset.act });
    toast(done ? 'Marked as done' : 'Appointment cancelled');
    rerender();
  })));
}
