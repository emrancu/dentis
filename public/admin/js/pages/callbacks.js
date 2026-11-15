import { esc, formatDateTime } from '../../../shared/util.js';
import { api } from '../api.js';
import { chip, confirmDialog, empty, guard, head, rerender, toast } from '../ui.js';
import { refreshCallbackBadge } from '../shell.js';

let callbackFilter = 'open';

export async function callbacksView(view) {
  const { items: all } = await api('GET', '/callbacks');
  const open = all.filter((c) => c.status === 'open');
  const items = callbackFilter === 'open' ? open : all;
  const row = (c) => `<tr class="${c.urgent && c.status === 'open' ? 'cb-urgent' : ''}">
      <td>${c.urgent ? '<span class="chip urgent">Urgent</span><br>' : ''}${esc(formatDateTime(c.created_at))}</td>
      <td><strong class="bn">${esc(c.name)}</strong><br><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td>
      <td>${esc(c.reason)}</td>
      <td>${esc(c.preferred_time || '–')}</td>
      <td>${chip(c.status)}</td>
      <td>${c.status === 'open' ? `<button class="btn btn-small btn-primary" data-done="${c.id}">Mark as called</button>` : ''} ${c.call_id ? `<a href="#/calls/${esc(c.call_id)}">Call</a>` : ''}</td></tr>`;
  view.innerHTML = `${head('Callbacks', 'People the voice agent passed to a human. Call them back, then mark it done.')}
    <div class="tabs" role="group" aria-label="Filter">
      ${[['open', 'Waiting', open.length], ['all', 'All', all.length]].map(([k, label, n]) => `<button type="button" class="tab" data-filter="${k}" aria-pressed="${callbackFilter === k}">${label} <span>${n}</span></button>`).join('')}
    </div>
    ${items.length
      ? `<div class="table-wrap"><table><thead><tr><th>Requested</th><th>Caller</th><th>What they need</th><th>Best time</th><th>Status</th><th></th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div>`
      : `<div class="table-wrap">${empty('Nobody is waiting for a callback.')}</div>`}`;
  view.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => ((callbackFilter = b.dataset.filter), rerender())));
  const byId = new Map(all.map((c) => [String(c.id), c]));
  view.querySelectorAll('[data-done]').forEach((b) => (b.onclick = guard(async () => {
    const c = byId.get(b.dataset.done);
    const ok = await confirmDialog({
      title: 'Mark as called?',
      text: `${c.name} (${c.phone}) will be removed from the waiting list. Only do this after you have spoken to them or tried to.`,
      confirm: 'Mark as called',
      cancel: 'Not yet',
    });
    if (!ok) return;
    await api('PATCH', `/callbacks/${b.dataset.done}/resolve`);
    toast('Marked as called');
    refreshCallbackBadge();
    rerender();
  })));
}
