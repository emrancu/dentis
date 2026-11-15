import { esc, formatDateTime, formatDuration, formatSlot, formatTime, statusLabel } from '../../../shared/util.js';
import { api } from '../api.js';
import { bindRows, chip, empty, guard, head } from '../ui.js';

export function callsTable(items) {
  if (!items.length) return `<div class="table-wrap">${empty('No calls match.')}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Date and time</th><th>Caller</th><th>Reason</th><th>Duration</th><th>Status</th></tr></thead><tbody>
    ${items.map((c) => `<tr class="click" tabindex="0" data-href="#/calls/${esc(c.id)}"><td>${esc(formatDateTime(c.started_at))}</td><td><strong class="bn">${esc(c.patient_name ?? 'Unknown caller')}</strong><br><span class="muted">${esc(c.phone ?? '–')}</span></td><td>${esc(c.reason_for_visit ?? '–')}</td><td>${esc(formatDuration(c.duration_s))}</td><td>${chip(c.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

export async function callsView(view) {
  view.innerHTML = `${head('Calls', 'Every conversation with the receptionist')}
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search name, phone, reason…" aria-label="Search calls">
      <select id="status" aria-label="Filter by status"><option value="">All statuses</option>${['booked', 'rescheduled', 'cancelled', 'enquiry', 'follow_up_needed', 'incomplete', 'failed', 'in_progress'].map((s) => `<option value="${s}">${esc(statusLabel(s))}</option>`).join('')}</select>
    </div><div id="list"></div>`;
  const load = guard(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (view.querySelector('#q').value.trim()) params.set('q', view.querySelector('#q').value.trim());
    if (view.querySelector('#status').value) params.set('status', view.querySelector('#status').value);
    view.querySelector('#list').innerHTML = callsTable((await api('GET', `/calls?${params}`)).items);
    bindRows(view);
  });
  let timer;
  view.querySelector('#q').oninput = () => (clearTimeout(timer), (timer = setTimeout(load, 250)));
  view.querySelector('#status').onchange = load;
  await load();
}

export async function callDetail(view, id) {
  const { call, extraction, turns, appointments, callbacks } = await api('GET', `/calls/${encodeURIComponent(id)}`);
  const field = (label, value) => `<dt>${esc(label)}</dt><dd class="bn">${value ? esc(value) : '<span class="muted">–</span>'}</dd>`;
  view.innerHTML = `
    <p><a href="#/calls">← All calls</a></p>
    ${head(extraction.patient_name ?? 'Unknown caller', `${formatDateTime(call.started_at)} · ${formatDuration(call.duration_s)}`, chip(call.status))}
    <div class="grid detail">
      <section class="card"><h2>Transcript</h2>
        ${turns.length ? `<div class="chat" tabindex="0" aria-label="Transcript">${turns.map((t) => `<div class="bubble ${esc(t.speaker)}"><div class="who">${t.speaker === 'agent' ? 'Receptionist' : 'Patient'}<time>${esc(formatTime(t.ts))}</time></div><div class="bn">${esc(t.text_bn)}</div>${t.text_en ? `<div class="en">${esc(t.text_en)}</div>` : ''}</div>`).join('')}</div>` : '<p class="muted">No transcript was captured for this call.</p>'}
      </section>
      <div class="stack">
        <section class="card"><h2>Captured details</h2><dl class="dl">
          ${field('Name', extraction.patient_name)}${field('Phone', extraction.phone)}${field('Reason for visit', extraction.reason_for_visit)}${field('Preferred time', /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(extraction.preferred_datetime ?? '') ? formatSlot(extraction.preferred_datetime) : extraction.preferred_datetime)}${field('Intent', extraction.intent)}${field('Outcome', extraction.outcome)}${field('Notes', extraction.notes)}
        </dl></section>
        ${appointments.length ? `<section class="card"><h2>Appointment</h2>${appointments.map((a) => `<dl class="dl"><dt>When</dt><dd>${esc(formatSlot(a.slot))}</dd><dt>Doctor</dt><dd>${esc(a.doctor_name)}</dd><dt>Service</dt><dd>${esc(a.service || '–')}</dd><dt>Status</dt><dd>${chip(a.status)}</dd></dl>`).join('<hr>')}</section>` : ''}
        ${callbacks.length ? `<section class="card"><h2>Follow-up requested</h2>${callbacks.map((c) => `<dl class="dl"><dt>Name</dt><dd>${esc(c.name)}</dd><dt>Phone</dt><dd>${esc(c.phone)}</dd><dt>Reason</dt><dd>${esc(c.reason)}</dd><dt>Status</dt><dd>${chip(c.status)}</dd></dl>`).join('<hr>')}</section>` : ''}
      </div>
    </div>`;
}
