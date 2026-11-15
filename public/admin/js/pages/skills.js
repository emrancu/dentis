import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { dialog, empty, guard, head, rerender, toast } from '../ui.js';

export async function skillsView(view) {
  const { items } = await api('GET', '/skills');
  const enabled = items.filter((s) => s.enabled).length;
  view.innerHTML = `${head('Agent knowledge', 'Everything here is knowledge the voice agent can look up during a call.', '<button class="btn btn-primary" id="add">+ Add entry</button>')}
    <div class="meter" role="status">
      <strong>${enabled} of ${items.length}</strong> entries are enabled
      <span>The agent sees the title of every enabled entry and fetches the details of the ones a question needs.</span>
    </div>
    ${items.length ? `<div class="skills">${items.map((s) => `
      <article class="card skill ${s.enabled ? '' : 'off'}"><h3>${esc(s.title)}</h3>${s.content ? `<div class="content bn">${esc(s.content)}</div>` : ''}
        <div class="actions"><label class="switch"><input type="checkbox" data-toggle="${s.id}" ${s.enabled ? 'checked' : ''}> ${s.enabled ? 'Enabled' : 'Disabled'}</label><span style="flex:1"></span><button class="btn btn-small" data-edit="${s.id}">Edit</button><button class="btn btn-small btn-danger" data-del="${s.id}">Delete</button></div>
      </article>`).join('')}</div>` : empty('No entries yet. Add the first one so the agent can answer questions.')}`;
  const byId = new Map(items.map((s) => [String(s.id), s]));
  view.querySelector('#add').onclick = () => skillDialog(null);
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
    <label class="field"><span>Title: what the agent looks up. Write it clearly, like "Root canal treatment cost", so the agent knows when to use it</span><input type="text" name="title" value="${esc(skill?.title ?? '')}" maxlength="80" required></label>
    <p class="hint">Everything here is for the voice agent only. The website lists its services separately. Write in English or Bangla.</p>
    <label class="field"><span>Details the agent will say: prices, steps, rules</span><textarea name="content" maxlength="4000" class="bn" required>${esc(skill?.content ?? '')}</textarea></label>
    <label class="switch"><input type="checkbox" name="enabled" ${skill?.enabled ?? true ? 'checked' : ''}> Enabled</label>`, (f) => {
    const body = { title: f.get('title'), content: f.get('content'), enabled: f.get('enabled') === 'on' };
    return skill ? api('PUT', `/skills/${skill.id}`, body) : api('POST', '/skills', body);
  });
}
