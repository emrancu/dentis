import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { head, toast } from '../ui.js';

export async function clinicView(view) {
  const p = await api('GET', '/settings');
  const input = (key, label, opts = '') => `<label class="field ${opts.includes('full') ? 'full' : ''}"><span>${label}</span><input type="text" name="${key}" value="${esc(p[key])}" ${opts.includes('bn') ? 'class="bn"' : ''}></label>`;
  const area = (key, label, bn) => `<label class="field"><span>${label}</span><textarea name="${key}" ${bn ? 'class="bn"' : ''}>${esc(p[key])}</textarea></label>`;
  const pair = (key, en, bn) => area(key, `${en} (English)`) + area(`${key}_bn`, bn, true);
  view.innerHTML = `${head('Clinic profile', 'The agent reads this when callers ask about hours or location')}
    <form class="card form-grid" id="clinic-form">
      ${input('name_en', 'Clinic name (English)')}${input('name_bn', 'Clinic name (বাংলা)', 'bn')}${input('phone', 'Phone')}
      <label class="field"><span>Appointment length</span><select name="slot_minutes">${[15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === p.slot_minutes ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
      <p class="hint full">Write English in the English box and Bangla in the Bangla box. The website shows the box for the visitor's language.</p>
      ${pair('address', 'Address', 'ঠিকানা (বাংলা)')}${pair('hours', 'Opening hours', 'খোলার সময় (বাংলা)')}${pair('directions', 'Directions', 'কীভাবে আসবেন (বাংলা)')}
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
