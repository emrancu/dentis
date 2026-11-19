import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { dialog, guard, head, rerender, toast } from '../ui.js';

const MAX_INSTRUCTIONS = 4000;
const MAX_GREETING = 300;
const MAX_CLOSING = 300;

export async function agentView(view) {
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
          <li>Greet, then wait: no name or questions until the caller says what they need</li>
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
    rerender();
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
