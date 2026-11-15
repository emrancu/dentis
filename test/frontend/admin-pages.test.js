import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createApp } from '../../src/app.js';
import { ACCESS_KEY, VALID_PHONE, buildWorld, startCall } from '../support/fixtures.js';

/** A stand-in for a DOM element: remembers innerHTML, and every other call or lookup does nothing. */
function element() {
  const store = { innerHTML: '', textContent: '', value: '', checked: false };
  const children = new Map();
  const noop = () => undefined;
  return new Proxy(noop, {
    get: (_, prop) => {
      if (prop in store) return store[prop];
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'querySelector') return (selector) => (children.has(selector) ? children.get(selector) : (children.set(selector, element()), children.get(selector)));
      if (prop === 'allHtml') return () => store.innerHTML + [...children.values()].map((c) => c.allHtml()).join('');
      if (prop === 'classList') return { toggle: noop, add: noop, remove: noop };
      if (prop === 'dataset' || prop === 'style') return {};
      if (prop === 'elements') return new Proxy({}, { get: () => element() });
      return noop;
    },
    set: (_, prop, value) => ((store[prop] = value), true),
    apply: () => undefined,
  });
}

let page;
let ids;

const setup = async () => {
  const world = await buildWorld();
  const app = createApp(world.services);
  const login = await app.handle(new Request('https://dentis.test/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_key: ACCESS_KEY }) }));
  const cookie = login.headers.get('Set-Cookie').split(';')[0];

  const callId = await startCall(world);
  await world.services.bookAppointment.execute({ callId, patientName: 'Rahim Uddin', phone: VALID_PHONE, reason: 'toothache', date: '2026-11-15', time: '10:30', doctorName: 'Nusrat' });
  await world.services.requestCallback.execute({ callId, name: 'Karim', phone: VALID_PHONE, reason: 'Needs a doctor to call', urgent: true });
  ids = { callId };

  const els = new Map();
  globalThis.document = { getElementById: (id) => (els.has(id) ? els.get(id) : (els.set(id, element()), els.get(id))) };
  globalThis.location = { hash: '', reload() {} };
  globalThis.confirm = () => true;
  globalThis.fetch = (url, init = {}) => app.handle(new Request(`https://dentis.test${url}`, { ...init, headers: { ...init.headers, Cookie: cookie } }));

  const load = (path) => import(`../../public/admin/js/${path}`);
  page = {
    overview: (await load('pages/overview.js')).overview,
    calls: await load('pages/calls.js'),
    appointments: (await load('pages/appointments.js')).appointmentsView,
    callbacks: (await load('pages/callbacks.js')).callbacksView,
    schedule: (await load('pages/schedule.js')).scheduleView,
    patients: (await load('pages/patients.js')).patientsView,
    agent: (await load('pages/agent.js')).agentView,
    skills: (await load('pages/skills.js')).skillsView,
    doctors: (await load('pages/doctors.js')).doctorsView,
    clinic: (await load('pages/clinic.js')).clinicView,
    howItWorks: (await load('pages/how-it-works.js')).howItWorksView,
    shell: await load('shell.js'),
    login: await load('login.js'),
  };
};

/** Draws a page against the real API. Catches a broken import, a missing helper or a bad field name. */
async function draw(fn, ...args) {
  const view = element();
  await fn(view, ...args);
  await new Promise((resolve) => setTimeout(resolve, 30)); // list pages fill in after their own fetch
  const html = view.allHtml();
  assert.ok(html.length > 50, 'the page drew nothing');
  assert.doesNotMatch(html, /undefined|\[object |NaN/);
  return html;
}

describe('admin pages draw against the real API', () => {
  before(setup);

  it('overview', async () => assert.match(await draw((v) => page.overview(v)), /Calls handled/));
  it('calls list and call detail', async () => {
    assert.match(await draw((v) => page.calls.callsView(v)), /Karim/);
    assert.match(await draw((v) => page.calls.callDetail(v, ids.callId)), /Karim/);
  });
  it('appointments', async () => assert.match(await draw((v) => page.appointments(v)), /Rahim Uddin/));
  it('callbacks', async () => assert.match(await draw((v) => page.callbacks(v)), /Karim/));
  it('schedule', async () => assert.ok(await draw((v) => page.schedule(v))));
  it('patients', async () => assert.match(await draw((v) => page.patients(v)), /Rahim Uddin/));
  it('agent prompt', async () => assert.ok(await draw((v) => page.agent(v))));
  it('agent knowledge', async () => assert.match(await draw((v) => page.skills(v)), /Scaling and polishing/));
  it('doctors', async () => assert.match(await draw((v) => page.doctors(v)), /Nusrat/));
  it('clinic profile', async () => assert.ok(await draw((v) => page.clinic(v))));
  it('how the agent works', async () => assert.match(await draw((v) => page.howItWorks(v)), /How the agent works/));

  it('the shell and the login page draw', async () => {
    await page.shell.renderShell();
    assert.match(document.getElementById('app').innerHTML, /Agent knowledge/);
    page.login.showLogin();
    assert.match(document.getElementById('app').innerHTML, /Access key/);
  });
});
