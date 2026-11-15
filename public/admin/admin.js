import { esc, formatDateTime, formatDuration, formatSlot, formatTime, statusLabel } from '/js/util.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAV = [
  ['', 'Overview'],
  ['calls', 'Calls'],
  ['appointments', 'Appointments'],
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
  view.innerHTML = `${head('Clinic profile', 'The agent reads this when callers ask about hours, location or preparation')}
    <form class="card form-grid" id="clinic-form">
      ${input('name_en', 'Clinic name (English)')}${input('name_bn', 'Clinic name (বাংলা)', 'bn')}${input('phone', 'Phone')}
      <label class="field"><span>Appointment length</span><select name="slot_minutes">${[15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === p.slot_minutes ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
      <p class="hint full">Write English in the English box and Bangla in the Bangla box. The website shows the box for the visitor's language.</p>
      ${pair('address', 'Address', 'ঠিকানা (বাংলা)')}${pair('hours', 'Opening hours', 'খোলার সময় (বাংলা)')}${pair('directions', 'Directions', 'কীভাবে আসবেন (বাংলা)')}${pair('prep_notes', 'Before your visit', 'আসার আগে (বাংলা)')}
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
function howItWorksView(view) {
  const nodes = [
    ['Caller', 'Speaks Bangla or English in the browser. Audio goes straight to the voice model.'],
    ['Voice model', 'Listens, understands and speaks. It follows the prompt you edit under Agent prompt.'],
    ['Dentis server', 'Runs the tools the model asks for. Checks every input before it is used.'],
    ['Your data', 'Knowledge, doctors, hours, free slots and bookings. The only source of facts.'],
  ];
  const steps = [
    ['The call starts', 'The server builds the prompt from what you saved, adds today\'s date, the doctors and the list of knowledge titles, and hands the browser a short-lived key. The real API key never leaves the server.'],
    ['The caller speaks', 'The model hears the question and decides what kind it is: something the clinic knows, something for a doctor, or something off topic.'],
    ['It asks the data, not its memory', 'For a fee, an hour, a doctor or a policy it calls a tool (<code>get_skill</code>, <code>lookup_skill</code>, <code>get_clinic_info</code>, <code>list_doctors</code>). For a booking it calls <code>check_availability</code> and offers only real free slots.'],
    ['It answers from what came back', 'The reply is built from the tool result. If the data has no answer, it says so and offers a colleague\'s call back. It does not guess.'],
    ['It does the work', 'Booking, rescheduling and cancelling go through the same checked code the staff use. A slot cannot be double booked, a phone number must be valid, a date must be real.'],
    ['It reads details back', 'Name, phone, date, time and doctor are repeated and confirmed before the booking is made.'],
    ['Everything is kept', 'At hang-up the transcript, the captured details, the appointment and the recording are saved and appear in this portal.'],
  ];
  const lanes = [
    ['ok', 'The clinic knows it', 'Fees, hours, directions, doctors, services, parking, what to bring.', 'The agent looks it up and answers in the caller\'s language, using the saved text.'],
    ['doctor', 'Only a doctor can answer', '"What is wrong with my tooth?" "Which medicine should I take?"', 'No diagnosis and no medicine advice. It explains that the dentist must examine them and offers a booking. Severe swelling, bleeding or trouble breathing: it sends them to emergency care.'],
    ['off', 'Not about the clinic', 'Politics, general chat, other businesses, anything unrelated.', 'It stays polite, says it can only help with the clinic, and brings the call back to dental care.'],
  ];
  const why = [
    ['Answers come from your data', 'Prices, hours and policies are fetched live from what you wrote here. Change an entry and the next call uses it, with no deploy and no retraining.'],
    ['It stays on the clinic', 'The scope and safety rules are locked in code and always added after the editable persona, followed by a line saying they win. Staff cannot edit them away by accident.'],
    ['It does not play doctor', 'A frightened caller with a toothache gets a booking and kindness, not a guess. That protects patients and the clinic.'],
    ['It really completes the task', 'It does not just talk. It books through validated tools, so what the caller hears is what is in the calendar.'],
    ['Small and quick', 'The prompt holds only the titles of the knowledge, never the details. The agent fetches one entry only when it needs it, which keeps the call fast and the cost low.'],
    ['You can check its work', 'Every call keeps its transcript, recording and captured fields. Listening to a few calls is the best test of any change.'],
  ];
  view.innerHTML = `${head('How the agent works', 'The full path of a call, and why callers get reliable answers')}
    <section class="card"><h2>The full flow</h2>
      <div class="diagram" role="img" aria-label="Caller, voice model, Dentis server and data, with answers returning the same way">
        ${nodes.map(([t, d], i) => `<div class="node"><strong>${t}</strong><span>${d}</span></div>${i < nodes.length - 1 ? '<span class="arrow" aria-hidden="true">⇄</span>' : ''}`).join('')}
      </div>
      <p class="muted diagram-note">Questions travel to the right. Facts travel back to the left. The voice model only says what the server returned.</p>
    </section>
    <div class="grid two" style="margin-top:16px">
      <section class="card"><h2>Step by step</h2><ol class="flow">${steps.map(([t, d]) => `<li><span><strong>${t}.</strong> ${d}</span></li>`).join('')}</ol></section>
      <section class="card"><h2>What happens to each question</h2>
        <div class="lanes">${lanes.map(([k, t, e, d]) => `<div class="lane lane-${k}"><strong>${t}</strong><em>${e}</em><span>${d}</span></div>`).join('')}</div>
      </section>
    </div>
    <h2 style="margin:24px 0 12px">Why this is a good support agent</h2>
    <div class="why">${why.map(([t, d]) => `<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
    <section class="card" style="margin-top:16px"><h2>Know the limits</h2>
      <p class="muted" style="margin:0">Staying on topic and refusing medical advice are rules in the prompt. The model follows them very well but no prompt is a guarantee, so review recordings of real calls. Facts and bookings are different: those are enforced by code and cannot be invented.</p>
    </section>`;
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
