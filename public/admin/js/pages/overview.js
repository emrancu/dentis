import { esc, formatDuration } from '../../../shared/util.js';
import { api } from '../api.js';
import { bindRows, chip, head } from '../ui.js';
import { callsTable } from './calls.js';

export async function overview(view) {
  const [d, calls] = await Promise.all([api('GET', '/dashboard'), api('GET', '/calls?limit=6')]);
  const max = Math.max(1, ...d.per_day.map((x) => x.count));
  view.innerHTML = `
    ${head('Overview', 'What your Bangla receptionist handled')}
    <div class="grid stats">
      <div class="card stat"><div class="n">${d.total}</div><div class="l">Calls handled</div></div>
      <div class="card stat"><div class="n">${d.by_status.booked ?? 0}</div><div class="l">Calls that booked</div></div>
      <div class="card stat"><div class="n">${esc(formatDuration(d.avg_duration_s))}</div><div class="l">Average call length</div></div>
      <div class="card stat"><div class="n">${d.upcoming_appointments}</div><div class="l">Upcoming appointments</div></div>
      <a class="card stat" href="#/callbacks"><div class="n">${d.open_callbacks}</div><div class="l">Callbacks waiting</div></a>
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
