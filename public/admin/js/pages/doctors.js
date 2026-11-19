import { esc } from '../../../shared/util.js';
import { api } from '../api.js';
import { chip, dialog, empty, guard, head, rerender, toast } from '../ui.js';

const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GENDER = { male: 'Male', female: 'Female', '': '–' };

export async function doctorsView(view) {
  const { items } = await api('GET', '/doctors');
  view.innerHTML = `${head('Doctors', 'The agent only books inside these working hours', '<button class="btn btn-primary" id="add">+ Add doctor</button>')}
    ${items.length ? `<div class="table-wrap"><table><thead><tr><th>Doctor</th><th>Degree</th><th>Gender</th><th>Experience</th><th>Specialty</th><th>Days</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>${items.map((d) => `<tr><td><strong>${esc(d.name_en)}</strong><br><span class="muted bn">${esc(d.name_bn)}</span></td><td>${esc(d.degree || '–')}${d.degree_bn ? `<br><span class="muted bn">${esc(d.degree_bn)}</span>` : ''}</td><td>${esc(GENDER[d.gender] ?? '–')}</td><td>${d.experience_years === null || d.experience_years === undefined ? '–' : `${esc(d.experience_years)} yrs`}</td><td>${esc(d.specialty || '–')}${d.specialty_bn ? `<br><span class="muted bn">${esc(d.specialty_bn)}</span>` : ''}</td><td>${esc(DAY_ORDER.filter((x) => d.days.includes(x)).map((x) => DAY_NAMES[x]).join(', '))}</td><td>${esc(d.start_time)}–${esc(d.end_time)}</td><td><span class="chip ${d.active ? 'booked' : 'cancelled'}">${d.active ? 'Active' : 'Inactive'}</span></td><td><button class="btn btn-small" data-edit="${d.id}">Edit</button> <button class="btn btn-small btn-danger" data-del="${d.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : empty('No doctors yet.')}`;
  const byId = new Map(items.map((d) => [String(d.id), d]));
  view.querySelector('#add').onclick = () => doctorDialog(null);
  view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => doctorDialog(byId.get(b.dataset.edit))));
  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = guard(async () => {
    if (!confirm(`Delete ${byId.get(b.dataset.del).name_en}?`)) return;
    try {
      await api('DELETE', `/doctors/${b.dataset.del}`);
      toast('Doctor deleted');
      rerender();
    } catch (error) {
      toast(error.code === 'doctor_has_appointments' ? 'This doctor has appointments. Edit them and mark inactive instead.' : error.message, true);
    }
  })));
}

function doctorDialog(d) {
  dialog(`<h2>${d ? 'Edit doctor' : 'Add doctor'}</h2>
    <div class="form-grid">
      <label class="field"><span>Name (English)</span><input type="text" name="name_en" value="${esc(d?.name_en ?? '')}" required></label>
      <label class="field"><span>Name (বাংলা)</span><input type="text" name="name_bn" value="${esc(d?.name_bn ?? '')}" class="bn"></label>
      <label class="field"><span>Specialty in English</span><input type="text" name="specialty" value="${esc(d?.specialty ?? '')}"></label>
      <label class="field"><span>Specialty in Bangla</span><input type="text" name="specialty_bn" value="${esc(d?.specialty_bn ?? '')}" class="bn"></label>
      <label class="field"><span>Degree in English</span><input type="text" name="degree" value="${esc(d?.degree ?? '')}" placeholder="BDS, MS (Endodontics)"></label>
      <label class="field"><span>Degree in Bangla</span><input type="text" name="degree_bn" value="${esc(d?.degree_bn ?? '')}" class="bn"></label>
      <label class="field"><span>Gender</span><select name="gender">${[['', 'Not set'], ['male', 'Male'], ['female', 'Female']].map(([v, label]) => `<option value="${v}" ${(d?.gender ?? '') === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="field"><span>Years of experience</span><input type="number" name="experience_years" min="0" max="70" step="1" value="${esc(d?.experience_years ?? '')}"></label>
      <label class="field"><span>Starts</span><input type="time" name="start_time" value="${esc(d?.start_time ?? '10:00')}" required></label>
      <label class="field"><span>Ends</span><input type="time" name="end_time" value="${esc(d?.end_time ?? '20:00')}" required></label>
      <div class="field full"><span>Working days</span><div class="days">${DAY_ORDER.map((n) => `<label><input type="checkbox" name="days" value="${n}" ${(d?.days ?? [6, 0, 1, 2, 3, 4]).includes(n) ? 'checked' : ''}><span>${DAY_NAMES[n]}</span></label>`).join('')}</div></div>
    </div>
    <label class="switch"><input type="checkbox" name="active" ${d?.active ?? true ? 'checked' : ''}> Active (can be booked)</label>`, (f) => {
    const body = { name_en: f.get('name_en'), name_bn: f.get('name_bn'), specialty: f.get('specialty'), specialty_bn: f.get('specialty_bn'), degree: f.get('degree'), degree_bn: f.get('degree_bn'), gender: f.get('gender'), experience_years: f.get('experience_years') === '' ? null : Number(f.get('experience_years')), start_time: f.get('start_time'), end_time: f.get('end_time'), days: f.getAll('days').map(Number), active: f.get('active') === 'on' };
    return d ? api('PUT', `/doctors/${d.id}`, body) : api('POST', '/doctors', body);
  });
}
