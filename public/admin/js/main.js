import { setUnauthorizedHandler, api } from './api.js';
import { showLogin } from './login.js';
import { renderShell } from './shell.js';
import { empty, setRerender } from './ui.js';
import { agentView } from './pages/agent.js';
import { appointmentsView } from './pages/appointments.js';
import { callDetail, callsView } from './pages/calls.js';
import { callbacksView } from './pages/callbacks.js';
import { clinicView } from './pages/clinic.js';
import { doctorsView } from './pages/doctors.js';
import { howItWorksView } from './pages/how-it-works.js';
import { overview } from './pages/overview.js';
import { patientsView } from './pages/patients.js';
import { scheduleView } from './pages/schedule.js';
import { skillsView } from './pages/skills.js';

const views = {
  '': overview,
  calls: callsView,
  appointments: appointmentsView,
  schedule: scheduleView,
  callbacks: callbacksView,
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

setUnauthorizedHandler(showLogin);
setRerender(route);

async function boot() {
  try {
    await api('GET', '/me');
    route();
  } catch (error) {
    if (error.status !== 401) document.getElementById('app').innerHTML = empty(error.message);
  }
}
addEventListener('hashchange', () => document.getElementById('view') && route());
boot();
