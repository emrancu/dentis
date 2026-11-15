import { esc } from '../../shared/util.js';
import { api } from './api.js';
import { showLogin } from './login.js';

const NAV = [
  ['', 'Overview'],
  ['calls', 'Calls'],
  ['appointments', 'Appointments'],
  ['schedule', 'Schedule'],
  ['callbacks', 'Callbacks'],
  ['patients', 'Patients'],
  ['agent', 'Agent prompt'],
  ['skills', 'Agent knowledge'],
  ['doctors', 'Doctors'],
  ['clinic', 'Clinic profile'],
  ['how-it-works', 'How the agent works'],
];

export async function renderShell() {
  const route = location.hash.replace(/^#\/?/, '');
  const base = route.split('/')[0];
  document.getElementById('app').innerHTML = `
    <div class="topbar"><button type="button" id="menu" aria-label="Open menu">☰</button><strong>Dentis</strong></div>
    <div class="shell">
      <aside class="side" id="side" aria-label="Sections">
        <a class="brand" href="#/"><img src="/logo-mark.svg" alt="">Dentis</a>
        ${NAV.map(([key, label]) => `<a class="nav" href="#/${key}" ${key === base ? 'aria-current="page"' : ''}>${esc(label)}${key === 'callbacks' ? '<span class="badge" id="cb-badge" hidden></span>' : ''}</a>`).join('')}
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
  refreshCallbackBadge();
}

/** The number of people waiting for a call, on the menu. Red when any of them is urgent. */
export function refreshCallbackBadge() {
  api('GET', '/callbacks?status=open').then(({ items }) => {
    const badge = document.getElementById('cb-badge');
    if (!badge) return;
    badge.hidden = items.length === 0;
    badge.textContent = items.length;
    badge.classList.toggle('urgent', items.some((c) => c.urgent));
  }).catch(() => {});
}
