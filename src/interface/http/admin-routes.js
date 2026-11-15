import { SESSION_SECONDS } from '../../application/admin-auth.js';
import { doctorDto, skillDto } from '../../application/dto.js';
import { TITLE_INDEX_CAP } from '../../domain/skills/skill.js';
import { json, noContent, readJson } from './router.js';

export const COOKIE = 'dentis_admin';

const doctorInput = (b) => ({ nameEn: b.name_en, nameBn: b.name_bn, specialty: b.specialty, specialtyBn: b.specialty_bn, days: b.days, startTime: b.start_time, endTime: b.end_time, active: b.active });
const skillInput = (b) => ({ title: b.title, description: b.description, titleBn: b.title_bn, descriptionBn: b.description_bn, content: b.content, kind: b.kind, keywords: b.keywords, enabled: b.enabled });
const promptInput = (b) => ({ instructions: b.instructions, greeting: b.greeting, closing: b.closing });
const id = (params) => Number(params.id);

function sessionCookie(token, request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api${secure}; Max-Age=${maxAge}`;
}

export function registerAdminRoutes(router, s) {
  const admin = { admin: true };

  router.add('POST', '/api/admin/login', async ({ request }) => {
    const token = await s.adminAuth.login((await readJson(request)).access_key);
    return noContent({ 'Set-Cookie': sessionCookie(token, request, SESSION_SECONDS) });
  });
  router.add('POST', '/api/admin/logout', async ({ request }) => noContent({ 'Set-Cookie': sessionCookie('', request, 0) }), admin);
  router.add('GET', '/api/admin/me', async () => json({ authenticated: true }), admin);

  router.add('GET', '/api/admin/dashboard', async () => json(await s.adminQueries.dashboard()), admin);
  router.add('GET', '/api/admin/calls', async ({ query }) => json(await s.adminQueries.listCalls(Object.fromEntries(query))), admin);
  router.add('GET', '/api/admin/calls/:id', async ({ params }) => json(await s.adminQueries.getCall(params.id)), admin);

  router.add('GET', '/api/admin/appointments', async ({ query }) => json(await s.adminQueries.listAppointments(Object.fromEntries(query))), admin);
  router.add('PATCH', '/api/admin/appointments/:id', async ({ request, params }) => json(await s.updateAppointmentStatus.execute(id(params), (await readJson(request)).status)), admin);
  router.add('GET', '/api/admin/patients', async ({ query }) => json(await s.adminQueries.listPatients(Object.fromEntries(query))), admin);
  router.add('GET', '/api/admin/callbacks', async ({ query }) => json(await s.adminQueries.listCallbacks(Object.fromEntries(query))), admin);
  router.add('PATCH', '/api/admin/callbacks/:id/resolve', async ({ params }) => json(await s.resolveCallback.execute(id(params))), admin);

  router.add('GET', '/api/admin/skills', async () => json({ items: (await s.skillCatalog.list()).map(skillDto), title_index_cap: TITLE_INDEX_CAP }), admin);
  router.add('POST', '/api/admin/skills', async ({ request }) => json(skillDto(await s.skillCatalog.create(skillInput(await readJson(request)))), 201), admin);
  router.add('PUT', '/api/admin/skills/:id', async ({ request, params }) => json(skillDto(await s.skillCatalog.update(id(params), skillInput(await readJson(request))))), admin);
  router.add('DELETE', '/api/admin/skills/:id', async ({ params }) => (await s.skillCatalog.remove(id(params)), noContent()), admin);

  router.add('GET', '/api/admin/doctors', async () => json({ items: (await s.doctorDirectory.list()).map(doctorDto) }), admin);
  router.add('POST', '/api/admin/doctors', async ({ request }) => json(doctorDto(await s.doctorDirectory.create(doctorInput(await readJson(request)))), 201), admin);
  router.add('PUT', '/api/admin/doctors/:id', async ({ request, params }) => json(doctorDto(await s.doctorDirectory.update(id(params), doctorInput(await readJson(request))))), admin);
  router.add('DELETE', '/api/admin/doctors/:id', async ({ params }) => (await s.doctorDirectory.remove(id(params)), noContent()), admin);

  router.add('GET', '/api/admin/agent', async () => json(await s.agentSettings.get()), admin);
  router.add('PUT', '/api/admin/agent', async ({ request }) => json(await s.agentSettings.update(promptInput(await readJson(request)))), admin);
  router.add('POST', '/api/admin/agent/preview', async ({ request }) => json(await s.agentSettings.preview(promptInput(await readJson(request)))), admin);

  router.add('GET', '/api/admin/settings', async () => json((await s.clinic.profile()).toJSON()), admin);
  router.add('PUT', '/api/admin/settings', async ({ request }) => json((await s.clinic.update(await readJson(request))).toJSON()), admin);
}
