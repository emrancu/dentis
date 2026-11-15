import { esc, formatDateTime } from '../../../shared/util.js';
import { api } from '../api.js';
import { empty, guard, head } from '../ui.js';

export async function patientsView(view) {
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
