import { json, readJson } from '../../shared/http.js';

const admin = { admin: true };

export function registerClinicRoutes(router, s) {
  router.add('GET', '/api/admin/settings', async () => json((await s.clinic.profile()).toJSON()), admin);
  router.add('PUT', '/api/admin/settings', async ({ request }) => json((await s.clinic.update(await readJson(request))).toJSON()), admin);
}
