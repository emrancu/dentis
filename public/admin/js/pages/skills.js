import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { chip, dialog, empty, guard, head, rerender, toast } from '../ui.js';

const KINDS = [['service', 'Service', 'Services'], ['faq', 'FAQ', 'FAQs'], ['policy', 'Policy', 'Policies']];
const kindLabel = (kind) => KINDS.find(([k]) => k === kind)?.[1] ?? kind;
let skillFilter = 'all';

export async function skillsView(view) {
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
      <article class="card skill ${s.enabled ? '' : 'off'}"><div><span class="chip kind-${esc(s.kind)}">${esc(kindLabel(s.kind))}</span></div><h3>${esc(s.title)}</h3><p class="muted" style="margin:0">${esc(s.description)}</p>${s.content ? `<div class="content bn">${esc(s.content)}</div>` : ''}
        <div class="actions"><label class="switch"><input type="checkbox" data-toggle="${s.id}" ${s.enabled ? 'checked' : ''}> ${s.enabled ? 'Enabled' : 'Disabled'}</label><span style="flex:1"></span><button class="btn btn-small" data-edit="${s.id}">Edit</button><button class="btn btn-small btn-danger" data-del="${s.id}">Delete</button></div>
      </article>`).join('')}</div>` : empty(items.length ? 'Nothing of this type yet.' : 'No entries yet. Add the first one so the agent can answer questions.')}`;
  const byId = new Map(items.map((s) => [String(s.id), s]));
  view.querySelector('#add').onclick = () => skillDialog(null);
  view.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => ((skillFilter = b.dataset.filter), rerender())));
  view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => skillDialog(byId.get(b.dataset.edit))));
  view.querySelectorAll('[data-toggle]').forEach((c) => (c.onchange = guard(async () => {
    const s = byId.get(c.dataset.toggle);
    await api('PUT', `/skills/${s.id}`, { ...s, enabled: c.checked });
    toast(c.checked ? 'Entry enabled' : 'Entry disabled');
    rerender();
  })));
  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = guard(async () => {
    if (!confirm(`Delete “${byId.get(b.dataset.del).title}”? The agent will stop knowing it.`)) return;
    await api('DELETE', `/skills/${b.dataset.del}`);
    toast('Entry deleted');
    rerender();
  })));
}

function skillDialog(skill) {
  dialog(`<h2>${skill ? 'Edit entry' : 'Add entry'}</h2>
    <label class="field"><span>Type</span><select name="kind">${KINDS.map(([k, label]) => `<option value="${k}" ${(skill?.kind ?? 'service') === k ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="field"><span>Title: what the agent looks up. Write it clearly, like "Root canal treatment cost", so the agent knows when to use it</span><input type="text" name="title" value="${esc(skill?.title ?? '')}" maxlength="80" required></label>
    <label class="field"><span>Description</span><input type="text" name="description" value="${esc(skill?.description ?? '')}" maxlength="400" required></label>
    <p class="hint">Everything here is for the voice agent only. The website lists its services separately. Write in English or Bangla.</p>
    <label class="field"><span>Details the agent will say: prices, steps, rules</span><textarea name="content" maxlength="4000" class="bn">${esc(skill?.content ?? '')}</textarea></label>
    <label class="switch"><input type="checkbox" name="enabled" ${skill?.enabled ?? true ? 'checked' : ''}> Enabled</label>`, (f) => {
    const body = { title: f.get('title'), description: f.get('description'), content: f.get('content'), kind: f.get('kind'), enabled: f.get('enabled') === 'on' };
    return skill ? api('PUT', `/skills/${skill.id}`, body) : api('POST', '/skills', body);
  });
}
