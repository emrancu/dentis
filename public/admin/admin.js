import { esc, formatDateTime, formatDuration, formatSlot, formatTime, statusLabel } from '/js/util.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAV = [
  ['', 'Overview'],
  ['calls', 'Calls'],
  ['appointments', 'Appointments'],
  ['schedule', 'Schedule'],
  ['patients', 'Patients'],
  ['agent', 'Agent prompt'],
  ['skills', 'Agent knowledge'],
  ['doctors', 'Doctors'],
  ['clinic', 'Clinic profile'],
  ['how-it-works', 'How the agent works'],
];

/* ---------- api ---------- */
class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? 'Something went wrong.');
    this.status = status;
    this.code = error?.code;
  }
}

async function api(method, path, body) {
  const response = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'X-Requested-With': 'dentis', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 && path !== '/login') {
    showLogin();
    throw new ApiError(401, { message: 'Please log in.' });
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error);
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = 'toast'), 3200);
}
const guard = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
  }
};

const chip = (status) => `<span class="chip ${esc(status)}">${esc(statusLabel(status))}</span>`;
const empty = (text) => `<div class="empty">${esc(text)}</div>`;

/* ---------- login ---------- */
function showLogin() {
  app.innerHTML = `
    <main class="login"><div class="login-card">
      <img src="/logo.svg" alt="Dentis Dental Care">
      <h1>Staff portal</h1><p class="muted">Enter the access key to see calls, bookings and settings.</p>
      <form id="login-form">
        <label class="field"><span>Access key</span><input type="password" name="key" autocomplete="current-password" required autofocus></label>
        <p class="error-text" id="login-error" role="alert"></p>
        <button class="btn btn-primary" type="submit">Log in</button>
      </form>
    </div></main>`;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/login', { access_key: new FormData(e.target).get('key') });
      boot();
    } catch (error) {
      document.getElementById('login-error').textContent = error.code === 'invalid_access_key' ? 'That access key is not correct.' : error.message;
    }
  });
}

/* ---------- shell ---------- */
async function renderShell() {
  const route = location.hash.replace(/^#\/?/, '');
  const base = route.split('/')[0];
  app.innerHTML = `
    <div class="topbar"><button type="button" id="menu" aria-label="Open menu">☰</button><strong>Dentis</strong></div>
    <div class="shell">
      <aside class="side" id="side" aria-label="Sections">
        <a class="brand" href="#/"><img src="/logo-mark.svg" alt="">Dentis</a>
        ${NAV.map(([key, label]) => `<a class="nav" href="#/${key}" ${key === base ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
        <span class="spacer"></span>
        <a class="nav" href="/" target="_blank" rel="noopener">View website ↗</a>
        <button class="nav" id="logout" type="button">Log out</button>
      </aside>
      <main class="main" id="view" tabindex="-1"></main>
    </div>`;
  document.getElementById('menu').onclick = () => document.getElementById('side').classList.toggle('open');
  document.getElementById('logout').onclick = async () => {
    await api('POST', '/logout').catch(() => {});
    showLogin();
  };
}

const views = {
  '': overview,
  calls: callsView,
  appointments: appointmentsView,
  schedule: scheduleView,
  patients: patientsView,
  agent: agentView,
  skills: skillsView,
  doctors: doctorsView,
  clinic: clinicView,
  'how-it-works': howItWorksView,
};

async function route() {
  await renderShell();
  const [base, id] = location.hash.replace(/^#\/?/, '').split('/');
  const view = document.getElementById('view');
  view.innerHTML = '<p class="muted">Loading…</p>';
  try {
    await (base === 'calls' && id ? callDetail(view, id) : (views[base] ?? overview)(view));
  } catch (error) {
    if (error.status !== 401) view.innerHTML = empty(error.message);
  }
}

const head = (title, subtitle = '', actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div>${actions}</div></div>`;

/* ---------- overview ---------- */
async function overview(view) {
  const [d, calls] = await Promise.all([api('GET', '/dashboard'), api('GET', '/calls?limit=6')]);
  const max = Math.max(1, ...d.per_day.map((x) => x.count));
  view.innerHTML = `
    ${head('Overview', 'What your Bangla receptionist handled')}
    <div class="grid stats">
      <div class="card stat"><div class="n">${d.total}</div><div class="l">Calls handled</div></div>
      <div class="card stat"><div class="n">${d.by_status.booked ?? 0}</div><div class="l">Calls that booked</div></div>
      <div class="card stat"><div class="n">${esc(formatDuration(d.avg_duration_s))}</div><div class="l">Average call length</div></div>
      <div class="card stat"><div class="n">${d.upcoming_appointments}</div><div class="l">Upcoming appointments</div></div>
    </div>
    <div class="grid two">
      <section class="card"><h2>Calls, last 7 days</h2>
        <div class="bars" role="img" aria-label="Calls per day for the last 7 days">${d.per_day.map((x) => `<div class="col"><span class="v">${x.count}</span><div class="bar" style="height:${Math.round((x.count / max) * 96) + 3}px"></div><span class="d">${esc(x.day.slice(5))}</span></div>`).join('')}</div>
      </section>
      <section class="card"><h2>Outcomes</h2>
        ${Object.keys(d.by_status).length ? `<dl class="dl">${Object.entries(d.by_status).map(([k, v]) => `<dt>${chip(k)}</dt><dd>${v}</dd>`).join('')}</dl>` : '<p class="muted">No calls yet.</p>'}
      </section>
    </div>
    <h2 style="margin:24px 0 12px">Latest calls</h2>${callsTable(calls.items)}`;
  bindRows(view);
}

/* ---------- calls ---------- */
function callsTable(items) {
  if (!items.length) return `<div class="table-wrap">${empty('No calls match.')}</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Date and time</th><th>Caller</th><th>Reason</th><th>Duration</th><th>Status</th></tr></thead><tbody>
    ${items.map((c) => `<tr class="click" tabindex="0" data-href="#/calls/${esc(c.id)}"><td>${esc(formatDateTime(c.started_at))}</td><td><strong class="bn">${esc(c.patient_name ?? 'Unknown caller')}</strong><br><span class="muted">${esc(c.phone ?? '–')}</span></td><td>${esc(c.reason_for_visit ?? '–')}</td><td>${esc(formatDuration(c.duration_s))}</td><td>${chip(c.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function bindRows(root) {
  root.querySelectorAll('tr[data-href]').forEach((row) => {
    row.onclick = () => (location.hash = row.dataset.href);
    row.onkeydown = (e) => e.key === 'Enter' && row.click();
  });
}

async function callsView(view) {
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

async function callDetail(view, id) {
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
        ${call.has_recording ? `<section class="card"><h2>Recording</h2><audio controls preload="none" src="/api/admin/calls/${encodeURIComponent(call.id)}/recording"></audio></section>` : ''}
        ${appointments.length ? `<section class="card"><h2>Appointment</h2>${appointments.map((a) => `<dl class="dl"><dt>When</dt><dd>${esc(formatSlot(a.slot))}</dd><dt>Doctor</dt><dd>${esc(a.doctor_name)}</dd><dt>Service</dt><dd>${esc(a.service || '–')}</dd><dt>Status</dt><dd>${chip(a.status)}</dd></dl>`).join('<hr>')}</section>` : ''}
        ${callbacks.length ? `<section class="card"><h2>Follow-up requested</h2>${callbacks.map((c) => `<dl class="dl"><dt>Name</dt><dd>${esc(c.name)}</dd><dt>Phone</dt><dd>${esc(c.phone)}</dd><dt>Reason</dt><dd>${esc(c.reason)}</dd><dt>Status</dt><dd>${chip(c.status)}</dd></dl>`).join('<hr>')}</section>` : ''}
      </div>
    </div>`;
}

/* ---------- appointments, patients ---------- */
async function appointmentsView(view) {
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
    route();
  })));
}

/* ---------- schedule: one day, one column per doctor ---------- */
const dhakaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
const shiftDate = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toClock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const clock12 = (hhmm) => `${Number(hhmm.slice(0, 2)) % 12 || 12}:${hhmm.slice(3, 5)} ${Number(hhmm.slice(0, 2)) < 12 ? 'am' : 'pm'}`;
let scheduleDate = null;

async function scheduleView(view) {
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
  const go = (iso) => { scheduleDate = iso; route(); };
  view.querySelector('#prev').onclick = () => go(shiftDate(date, -1));
  view.querySelector('#next').onclick = () => go(shiftDate(date, 1));
  view.querySelector('#today').onclick = () => go(dhakaToday());
  view.querySelector('#pick').onchange = (e) => e.target.value && go(e.target.value);
}

async function patientsView(view) {
  view.innerHTML = `${head('Patients', 'People who have given their details on a call')}<div class="toolbar"><input type="search" id="q" placeholder="Search name or phone…" aria-label="Search patients"></div><div id="list"></div>`;
  const load = guard(async () => {
    const q = view.querySelector('#q').value.trim();
    const { items } = await api('GET', `/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    view.querySelector('#list').innerHTML = items.length
      ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>First seen</th></tr></thead><tbody>${items.map((p) => `<tr><td class="bn">${esc(p.full_name)}</td><td>${esc(p.phone)}</td><td>${esc(formatDateTime(p.created_at))}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="table-wrap">${empty('No patients yet.')}</div>`;
  });
  let timer;
  view.querySelector('#q').oninput = () => (clearTimeout(timer), (timer = setTimeout(load, 250)));
  await load();
}

/* ---------- agent prompt ---------- */
const MAX_INSTRUCTIONS = 4000;
const MAX_GREETING = 300;
const MAX_CLOSING = 300;

async function agentView(view) {
  const a = await api('GET', '/agent');
  view.innerHTML = `${head('Agent prompt', 'How the voice agent sounds. Saved text is used from the next call.')}
    <div class="grid two">
      <form class="card stack" id="agent-form">
        <label class="field"><span>Instructions: persona, tone and language <small class="counter" id="count-instructions"></small></span>
          <textarea name="instructions" rows="14" class="bn" spellcheck="false">${esc(a.instructions)}</textarea></label>
        <label class="field"><span>Greeting <small class="counter" id="count-greeting"></small></span>
          <textarea name="greeting" rows="3" class="bn" spellcheck="false">${esc(a.greeting)}</textarea></label>
        <label class="field"><span>Closing: said when the call ends <small class="counter" id="count-closing"></small></span>
          <textarea name="closing" rows="3" class="bn" spellcheck="false">${esc(a.closing)}</textarea></label>
        <p class="hint">Write <code>{clinic}</code> where the clinic name should go.</p>
        <p class="error-text" id="agent-error" role="alert"></p>
        <div class="toolbar" style="margin:0">
          <button class="btn btn-primary" type="submit">Save changes</button>
          <button class="btn" type="button" id="preview">Show final prompt</button>
          <button class="btn btn-danger" type="button" id="reset">Reset to default</button>
        </div>
      </form>
      <section class="card"><h2>Always applied by the system</h2>
        <p class="muted" style="margin-top:0">These parts stay in code, come after your text, and win over it. They cannot be edited or removed here.</p>
        <ul class="locked">
          <li>Today's date and time</li>
          <li>The call flow: name, phone read back in English digits, reason, time, confirm before booking</li>
          <li>Facts only from the clinic's tools: never invent prices, hours or slots</li>
          <li>Safety: no medical advice, emergencies go to a doctor or hospital</li>
          <li>Clinic hours, doctors and the knowledge topic titles</li>
        </ul>
      </section>
    </div>`;
  const form = view.querySelector('#agent-form');
  const field = (name) => form.elements[name];
  const count = (name, max, el) => {
    const n = field(name).value.length;
    el.textContent = `${n} / ${max}`;
    el.classList.toggle('over', n > max);
  };
  const update = () => {
    count('instructions', MAX_INSTRUCTIONS, view.querySelector('#count-instructions'));
    count('greeting', MAX_GREETING, view.querySelector('#count-greeting'));
    count('closing', MAX_CLOSING, view.querySelector('#count-closing'));
  };
  form.addEventListener('input', update);
  update();
  const body = () => ({ instructions: field('instructions').value, greeting: field('greeting').value, closing: field('closing').value });
  const errorEl = view.querySelector('#agent-error');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    try {
      await api('PUT', '/agent', body());
      toast('Saved. The next call uses this.');
    } catch (error) {
      if (error.status !== 401) errorEl.textContent = error.message;
    }
  };
  view.querySelector('#reset').onclick = guard(async () => {
    if (!confirm('Reset the instructions, greeting and closing to the built-in defaults?')) return;
    await api('PUT', '/agent', { instructions: '', greeting: '', closing: '' });
    toast('Reset to default');
    route();
  });
  view.querySelector('#preview').onclick = guard(async () => {
    errorEl.textContent = '';
    try {
      const { prompt } = await api('POST', '/agent/preview', body());
      const dlg = document.createElement('dialog');
      dlg.innerHTML = `<form method="dialog"><h2>Final prompt</h2><p class="muted" style="margin:0">What a new call would be given, with today's date, your clinic, doctors and knowledge titles.</p><pre class="prompt-pre bn">${esc(prompt)}</pre><div class="dialog-actions"><button class="btn btn-primary">Close</button></div></form>`;
      document.body.append(dlg);
      dlg.onclose = () => dlg.remove();
      dlg.showModal();
    } catch (error) {
      if (error.status !== 401) errorEl.textContent = error.message;
    }
  });
}

/* ---------- skills ---------- */
const KINDS = [['service', 'Service', 'Services'], ['faq', 'FAQ', 'FAQs'], ['policy', 'Policy', 'Policies']];
const kindLabel = (kind) => KINDS.find(([k]) => k === kind)?.[1] ?? kind;
let skillFilter = 'all';

async function skillsView(view) {
  const { items, title_index_cap: cap } = await api('GET', '/skills');
  const enabled = items.filter((s) => s.enabled).length;
  const over = enabled > cap;
  const shown = skillFilter === 'all' ? items : items.filter((s) => s.kind === skillFilter);
  view.innerHTML = `${head('Agent knowledge', 'Everything here is knowledge the voice agent can look up during a call.', '<button class="btn btn-primary" id="add">+ Add entry</button>')}
    <div class="meter ${over ? 'over' : enabled >= cap * 0.9 ? 'near' : ''}" role="status">
      <strong>${enabled} of ${cap}</strong> titles in the agent's index
      <span>${over ? 'Over the limit: the agent no longer sees the list and has to search. Disable or merge some entries.' : enabled >= cap * 0.9 ? 'Close to the limit.' : 'The agent sees every enabled title and fetches the details when needed.'}</span>
    </div>
    <div class="tabs" role="group" aria-label="Filter by type">
      ${[['all', 'All', items.length], ...KINDS.map(([k, , plural]) => [k, plural, items.filter((s) => s.kind === k).length])].map(([k, label, n]) => `<button type="button" class="tab" data-filter="${k}" aria-pressed="${skillFilter === k}">${esc(label)} <span>${n}</span></button>`).join('')}
    </div>
    ${shown.length ? `<div class="skills">${shown.map((s) => `
      <article class="card skill ${s.enabled ? '' : 'off'}"><div><span class="chip kind-${esc(s.kind)}">${esc(kindLabel(s.kind))}</span></div><h3>${esc(s.title)}</h3>${s.title_bn ? `<p class="muted bn" style="margin:-4px 0 0">${esc(s.title_bn)}</p>` : ''}<p class="muted" style="margin:0">${esc(s.description)}</p>${s.content ? `<div class="content bn">${esc(s.content)}</div>` : ''}${s.keywords ? `<p class="keywords bn">${esc(s.keywords)}</p>` : ''}
        <div class="actions"><label class="switch"><input type="checkbox" data-toggle="${s.id}" ${s.enabled ? 'checked' : ''}> ${s.enabled ? 'Enabled' : 'Disabled'}</label><span style="flex:1"></span><button class="btn btn-small" data-edit="${s.id}">Edit</button><button class="btn btn-small btn-danger" data-del="${s.id}">Delete</button></div>
      </article>`).join('')}</div>` : empty(items.length ? 'Nothing of this type yet.' : 'No entries yet. Add the first one so the agent can answer questions.')}`;
  const byId = new Map(items.map((s) => [String(s.id), s]));
  view.querySelector('#add').onclick = () => skillDialog(null);
  view.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => ((skillFilter = b.dataset.filter), route())));
  view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => skillDialog(byId.get(b.dataset.edit))));
  view.querySelectorAll('[data-toggle]').forEach((c) => (c.onchange = guard(async () => {
    const s = byId.get(c.dataset.toggle);
    await api('PUT', `/skills/${s.id}`, { ...s, enabled: c.checked });
    toast(c.checked ? 'Entry enabled' : 'Entry disabled');
    route();
  })));
  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = guard(async () => {
    if (!confirm(`Delete “${byId.get(b.dataset.del).title}”? The agent will stop knowing it.`)) return;
    await api('DELETE', `/skills/${b.dataset.del}`);
    toast('Entry deleted');
    route();
  })));
}

/** A small yes/no modal. Resolves true on confirm, false on cancel, Escape or backdrop click. */
function confirmDialog({ title, text, confirm: confirmLabel, cancel: cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm';
    dlg.setAttribute('aria-labelledby', 'confirm-title');
    dlg.innerHTML = `<form method="dialog"><h2 id="confirm-title">${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p><div class="dialog-actions"><button type="button" class="btn" data-no>${esc(cancelLabel)}</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmLabel)}</button></div></form>`;
    document.body.append(dlg);
    let answer = false;
    dlg.querySelector('[data-no]').onclick = () => dlg.close();
    dlg.querySelector('[data-yes]').onclick = () => ((answer = true), dlg.close());
    dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
    dlg.onclose = () => { dlg.remove(); resolve(answer); };
    dlg.showModal();
    dlg.querySelector('[data-no]').focus();
  });
}

function dialog(html, onSubmit) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog">${html}<p class="error-text" data-error role="alert"></p><div class="dialog-actions"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`;
  document.body.append(dlg);
  dlg.querySelector('[data-cancel]').onclick = () => dlg.close();
  dlg.onclose = () => dlg.remove();
  dlg.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(new FormData(e.target));
      dlg.close();
      route();
    } catch (error) {
      if (error.status === 401) dlg.close();
      else dlg.querySelector('[data-error]').textContent = error.message;
    }
  };
  dlg.showModal();
  return dlg;
}

function skillDialog(skill) {
  dialog(`<h2>${skill ? 'Edit entry' : 'Add entry'}</h2>
    <label class="field"><span>Type</span><select name="kind">${KINDS.map(([k, label]) => `<option value="${k}" ${(skill?.kind ?? 'service') === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="field"><span>Title in English: what the agent looks up</span><input type="text" name="title" value="${esc(skill?.title ?? '')}" maxlength="80" required></label>
    <label class="field"><span>Description in English</span><input type="text" name="description" value="${esc(skill?.description ?? '')}" maxlength="400" required></label>
    <label class="field"><span>Title in Bangla (helps the agent match callers)</span><input type="text" name="title_bn" value="${esc(skill?.title_bn ?? '')}" maxlength="80" class="bn"></label>
    <label class="field"><span>Description in Bangla (helps the agent match callers)</span><input type="text" name="description_bn" value="${esc(skill?.description_bn ?? '')}" maxlength="400" class="bn"></label>
    <p class="hint">Everything here is for the voice agent only. The website lists its services separately. Bangla text is optional.</p>
    <label class="field"><span>Details the agent will say: prices, steps, rules</span><textarea name="content" maxlength="4000" class="bn">${esc(skill?.content ?? '')}</textarea></label>
    <label class="field"><span>Keywords: other words callers use, Bangla and English, separated by commas</span><input type="text" name="keywords" value="${esc(skill?.keywords ?? '')}" maxlength="300" class="bn" placeholder="wisdom, দাঁত তোলা, আক্কেল দাঁত"></label>
    <label class="switch"><input type="checkbox" name="enabled" ${skill?.enabled ?? true ? 'checked' : ''}> Enabled</label>`, (f) => {
    const body = { title: f.get('title'), description: f.get('description'), title_bn: f.get('title_bn'), description_bn: f.get('description_bn'), content: f.get('content'), kind: f.get('kind'), keywords: f.get('keywords'), enabled: f.get('enabled') === 'on' };
    return skill ? api('PUT', `/skills/${skill.id}`, body) : api('POST', '/skills', body);
  });
}

/* ---------- doctors ---------- */
async function doctorsView(view) {
  const { items } = await api('GET', '/doctors');
  view.innerHTML = `${head('Doctors', 'The agent only books inside these working hours', '<button class="btn btn-primary" id="add">+ Add doctor</button>')}
    ${items.length ? `<div class="table-wrap"><table><thead><tr><th>Doctor</th><th>Specialty</th><th>Days</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>${items.map((d) => `<tr><td><strong>${esc(d.name_en)}</strong><br><span class="muted bn">${esc(d.name_bn)}</span></td><td>${esc(d.specialty || '–')}${d.specialty_bn ? `<br><span class="muted bn">${esc(d.specialty_bn)}</span>` : ''}</td><td>${esc(DAY_ORDER.filter((x) => d.days.includes(x)).map((x) => DAY_NAMES[x]).join(', '))}</td><td>${esc(d.start_time)}–${esc(d.end_time)}</td><td><span class="chip ${d.active ? 'booked' : 'cancelled'}">${d.active ? 'Active' : 'Inactive'}</span></td><td><button class="btn btn-small" data-edit="${d.id}">Edit</button> <button class="btn btn-small btn-danger" data-del="${d.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : empty('No doctors yet.')}`;
  const byId = new Map(items.map((d) => [String(d.id), d]));
  view.querySelector('#add').onclick = () => doctorDialog(null);
  view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => doctorDialog(byId.get(b.dataset.edit))));
  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = guard(async () => {
    if (!confirm(`Delete ${byId.get(b.dataset.del).name_en}?`)) return;
    try {
      await api('DELETE', `/doctors/${b.dataset.del}`);
      toast('Doctor deleted');
      route();
    } catch (error) {
      toast(error.code === 'doctor_has_appointments' ? 'This doctor has appointments. Edit them and mark inactive instead.' : error.message, true);
    }
  })));
}

function doctorDialog(d) {
  dialog(`<h2>${d ? 'Edit doctor' : 'Add doctor'}</h2>
    <div class="form-grid">
      <label class="field"><span>Name (English)</span><input type="text" name="name_en" value="${esc(d?.name_en ?? '')}" required></label>
      <label class="field"><span>Name (বাংলা)</span><input type="text" name="name_bn" value="${esc(d?.name_bn ?? '')}" class="bn"></label>
      <label class="field"><span>Specialty in English</span><input type="text" name="specialty" value="${esc(d?.specialty ?? '')}"></label>
      <label class="field"><span>Specialty in Bangla</span><input type="text" name="specialty_bn" value="${esc(d?.specialty_bn ?? '')}" class="bn"></label>
      <label class="field"><span>Starts</span><input type="time" name="start_time" value="${esc(d?.start_time ?? '10:00')}" required></label>
      <label class="field"><span>Ends</span><input type="time" name="end_time" value="${esc(d?.end_time ?? '20:00')}" required></label>
      <div class="field full"><span>Working days</span><div class="days">${DAY_ORDER.map((n) => `<label><input type="checkbox" name="days" value="${n}" ${(d?.days ?? [6, 0, 1, 2, 3, 4]).includes(n) ? 'checked' : ''}><span>${DAY_NAMES[n]}</span></label>`).join('')}</div></div>
    </div>
    <label class="switch"><input type="checkbox" name="active" ${d?.active ?? true ? 'checked' : ''}> Active (can be booked)</label>`, (f) => {
    const body = { name_en: f.get('name_en'), name_bn: f.get('name_bn'), specialty: f.get('specialty'), specialty_bn: f.get('specialty_bn'), start_time: f.get('start_time'), end_time: f.get('end_time'), days: f.getAll('days').map(Number), active: f.get('active') === 'on' };
    return d ? api('PUT', `/doctors/${d.id}`, body) : api('POST', '/doctors', body);
  });
}

/* ---------- clinic profile ---------- */
async function clinicView(view) {
  const p = await api('GET', '/settings');
  const input = (key, label, opts = '') => `<label class="field ${opts.includes('full') ? 'full' : ''}"><span>${label}</span><input type="text" name="${key}" value="${esc(p[key])}" ${opts.includes('bn') ? 'class="bn"' : ''}></label>`;
  const area = (key, label, bn) => `<label class="field"><span>${label}</span><textarea name="${key}" ${bn ? 'class="bn"' : ''}>${esc(p[key])}</textarea></label>`;
  const pair = (key, en, bn) => area(key, `${en} (English)`) + area(`${key}_bn`, bn, true);
  view.innerHTML = `${head('Clinic profile', 'The agent reads this when callers ask about hours or location')}
    <form class="card form-grid" id="clinic-form">
      ${input('name_en', 'Clinic name (English)')}${input('name_bn', 'Clinic name (বাংলা)', 'bn')}${input('phone', 'Phone')}
      <label class="field"><span>Appointment length</span><select name="slot_minutes">${[15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === p.slot_minutes ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
      <p class="hint full">Write English in the English box and Bangla in the Bangla box. The website shows the box for the visitor's language.</p>
      ${pair('address', 'Address', 'ঠিকানা (বাংলা)')}${pair('hours', 'Opening hours', 'খোলার সময় (বাংলা)')}${pair('directions', 'Directions', 'কীভাবে আসবেন (বাংলা)')}
      <div class="full"><p class="error-text" id="clinic-error" role="alert"></p><button class="btn btn-primary" type="submit">Save changes</button></div>
    </form>`;
  view.querySelector('#clinic-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.slot_minutes = Number(body.slot_minutes);
    try {
      await api('PUT', '/settings', body);
      toast('Clinic profile saved. The agent uses it on the next call.');
    } catch (error) {
      if (error.status !== 401) view.querySelector('#clinic-error').textContent = error.message;
    }
  };
}

/* ---------- how data is stored ---------- */
/** Engineering reference for reviewers: architecture, sequence, trust boundaries, tool surface, failure modes, limits. */
function howItWorksView(view) {
  // Sequence diagram: lifelines left to right, then messages top to bottom. [from, to, label, dashed?]
  const lanes = ['Browser', 'Worker', 'OpenAI Realtime', 'D1 / R2'];
  const msgs = [
    [0, 1, '1  POST /api/session {intent}'],
    [1, 3, '2  read settings, doctors, skills'],
    [1, 2, '3  POST /v1/realtime/client_secrets (prompt + tools)'],
    [2, 1, '4  ephemeral key (TTL 300 s)', true],
    [1, 0, '5  {call_id, key, greeting, closing}', true],
    [0, 2, '6  WebRTC: SDP offer, mic audio, data channel'],
    [2, 0, '7  audio out, events, function_call', true],
    [0, 1, '8  POST /api/agent/tools/:name {call_id, args}'],
    [1, 3, '9  validate, read or write'],
    [1, 0, '10  {ok, ...} result', true],
    [0, 2, '11  function_call_output + response.create'],
    [0, 1, '12  POST /api/calls/:id/finish {turns, reason}'],
    [0, 1, '13  PUT /api/calls/:id/recording (webm, 10 MB cap)'],
    [1, 3, '14  status derived, turns saved, audio to R2'],
  ];
  const W = 960, left = 80, gap = 266, top = 54, row = 34;
  const x = (n) => left + n * gap;
  const H = top + msgs.length * row + 24;
  const svg = `<svg class="seq" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sequence of one call across browser, worker, OpenAI and storage">
    <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>
    ${lanes.map((l, n) => `<text x="${x(n)}" y="22" text-anchor="middle" class="seq-lane">${l}</text><line x1="${x(n)}" y1="34" x2="${x(n)}" y2="${H - 10}" class="seq-line"/>`).join('')}
    ${msgs.map(([a, b, label, dashed], k) => {
      const y = top + k * row;
      const x1 = x(a), x2 = x(b);
      const mid = (x1 + x2) / 2;
      return `<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -4 : 4)}" y2="${y}" class="seq-msg${dashed ? ' back' : ''}" marker-end="url(#ah)"/><text x="${mid}" y="${y - 6}" text-anchor="middle" class="seq-text">${esc(label)}</text>`;
    }).join('')}
  </svg>`;

  const tools = [
    ['get_current_datetime, get_clinic_info, list_doctors', 'read', 'settings, doctors', 'none needed, read only'],
    ['list_skills, get_skill, lookup_skill', 'read', 'skills (enabled only)', 'exact title match, ranked search with Bangla endings'],
    ['check_availability', 'read', 'doctors, appointments', 'real date, not past, within 60 days, inside doctor hours'],
    ['book_appointment', 'write', 'patients, appointments, extractions', 'valid BD mobile, unique index on (doctor, slot) while booked, name cleaned'],
    ['reschedule_appointment, cancel_appointment', 'write', 'appointments', 'matched by phone and date, only the caller\'s own upcoming booking'],
    ['save_patient_details', 'write', 'patients, call_extractions', 'phone normalised (Bangla digits, +880), partial saves allowed'],
    ['request_human_callback', 'write', 'callbacks', 'valid phone, reason required'],
    ['end_call', 'control', 'none', 'browser speaks the closing line, then hangs up'],
  ];
  const trust = [
    ['OpenAI API key', 'Worker secret only. The browser gets an ephemeral client secret (TTL 300 s) scoped to one session.'],
    ['Session start', 'Public endpoint. Per-IP limit of 10 sessions an hour, IP stored as a hash. Calls are capped at 300 s.'],
    ['Tool endpoint', 'Public, keyed by a call id (uuid) that must exist and not be finished. All input is validated in the domain layer; the model is treated as an untrusted caller.'],
    ['Prompt', 'Persona text is editable. Flow, tool rules, safety and the knowledge list are code, appended last, with a line saying they win. Caller speech and tool results are data, never instructions.'],
    ['Admin', 'Access key to an HMAC-signed cookie. Every write needs an X-Requested-With header (CSRF guard).'],
    ['Secrets', '.dev.vars locally, Wrangler secrets in production. Nothing in the repo. Fake patient data only.'],
  ];
  const failures = [
    ['OpenAI session create fails', 'The call row is marked failed, the visitor sees a retry panel. Nothing is billed.'],
    ['Mic denied or missing', 'Mapped to a specific message before any server work is wasted.'],
    ['Connection drops mid-call', 'The browser reports reason "error". The call is saved with what was said so far.'],
    ['Tool endpoint unreachable or errors', 'The model receives {ok:false, error:"tool_unavailable"} and is told to offer a human callback. It cannot confirm a booking that did not happen.'],
    ['Page closed mid-call', 'sendBeacon sends the transcript. If it never arrives the call shows as incomplete.'],
    ['Caller goes silent', 'Nudge at 15 s, closing line and hang-up at 30 s (public/js/idle.js).'],
    ['Slot taken between check and book', 'The unique index rejects the second insert; the tool returns slot_unavailable with alternatives and the agent offers other times.'],
    ['Recording upload fails', 'Best effort. The call, transcript and details are already saved.'],
  ];
  const limits = [
    ['Voice model', 'gpt-realtime-mini, voice marin, semantic VAD, near-field noise reduction'],
    ['Caller transcription', 'gpt-4o-mini-transcribe, language bn'],
    ['Call length', '300 s hard cap (MAX_CALL_SECONDS)'],
    ['Session rate', '10 per IP per hour (MAX_SESSIONS_PER_HOUR)'],
    ['Prompt size', 'Persona up to 4000 chars, greeting and closing 300 each; knowledge titles only, capped at 40 (TITLE_INDEX_CAP)'],
    ['Recording', 'webm, up to 10 MB, private R2 bucket'],
    ['Runtime', 'One Cloudflare Worker, D1 (SQLite), R2. No queues, no cron, no cache layer; reads go straight to D1 each call.'],
  ];
  const gaps = [
    'The transcript and the recording are produced in the browser and reported by it. The server cannot verify them against OpenAI. They are for staff review, not for evidence.',
    'The tool endpoint trusts the call id as its only credential. It is a random uuid and stops working once the call finishes, but it is not a signed token. Binding tools to the ephemeral session would be the next hardening step.',
    'The "stays on topic, no medical advice" behaviour is prompt-enforced, so it is probabilistic. Facts and bookings are code-enforced. Review real recordings; there is no automated conversation eval yet, only a retrieval eval for knowledge lookup.',
    'Latency, token cost per call and behaviour under concurrent load are not measured. The mini model was chosen for cost, and its Bangla quality has not been benchmarked against the full model.',
    'There is no post-call analysis. Anything the agent did not save through a tool is only in the transcript.',
  ];
  const table = (heads, rows) => `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => `<td${k === 0 ? ' class="mono"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  view.innerHTML = `${head('How the agent works', 'Engineering reference: architecture, one call end to end, trust boundaries, failure modes')}
    <section class="card"><h2>Architecture</h2>
      <div class="arch">
        <div class="arch-col"><h3>Browser</h3><ul><li>Vanilla JS, <code>BanglaCall</code></li><li>RTCPeerConnection to OpenAI for audio and a data channel for events</li><li>MediaRecorder for the recording</li><li>Relays tool calls to the Worker</li></ul></div>
        <div class="arch-col arch-main"><h3>Cloudflare Worker</h3>
          <div class="layers">
            <div><b>interface</b> routes, auth, JSON, error mapping</div>
            <div><b>application</b> use cases: StartCall, ToolExecutor, BookAppointment, FinishCall</div>
            <div><b>domain</b> Slot, PhoneNumber, Skill, AgentPrompt, Call (no I/O)</div>
            <div><b>infrastructure</b> D1 repositories, R2, OpenAI gateway, WebCrypto</div>
          </div>
          <p>Dependencies point inward. A layering test fails the build if a domain file imports from outside.</p>
        </div>
        <div class="arch-col"><h3>External</h3><ul><li><b>OpenAI Realtime</b> speech in, speech out, tool calls</li><li><b>D1</b> relational data</li><li><b>R2</b> private recordings</li></ul></div>
      </div>
    </section>
    <section class="card" style="margin-top:16px"><h2>One call, end to end</h2>${svg}
      <p class="muted diagram-note">Solid arrows are requests, dashed arrows are replies. Audio never touches the Worker: it goes browser to OpenAI directly. The Worker only sees text, over HTTPS.</p>
    </section>
    <h2 class="eng-h">Tool surface</h2>${table(['Tool', 'Type', 'Touches', 'Guards'], tools)}
    <h2 class="eng-h">Trust boundaries</h2>${table(['Area', 'How it is handled'], trust)}
    <h2 class="eng-h">Failure modes</h2>${table(['Failure', 'Behaviour'], failures)}
    <h2 class="eng-h">Models, limits and cost knobs</h2>${table(['Item', 'Value'], limits)}
    <section class="card" style="margin-top:16px"><h2>Known gaps</h2><ul class="gaps">${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>`;
}

/* ---------- boot ---------- */
async function boot() {
  try {
    await api('GET', '/me');
    route();
  } catch (error) {
    if (error.status !== 401) app.innerHTML = empty(error.message);
  }
}
addEventListener('hashchange', () => document.getElementById('view') && route());
boot();
