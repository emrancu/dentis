import { json, readJson } from '../../shared/http.js';

const admin = { admin: true };
const id = (params) => Number(params.id);

/** What happened: the dashboard, calls, appointments, patients and callback requests. */
export function registerActivityRoutes(router, s) {
  router.add('GET', '/api/admin/dashboard', async () => json(await s.adminQueries.dashboard()), admin);
  router.add('GET', '/api/admin/calls', async ({ query }) => json(await s.adminQueries.listCalls(Object.fromEntries(query))), admin);
  router.add('GET', '/api/admin/calls/:id', async ({ params }) => json(await s.adminQueries.getCall(params.id)), admin);

  router.add('GET', '/api/admin/appointments', async ({ query }) => json(await s.adminQueries.listAppointments(Object.fromEntries(query))), admin);
  router.add('PATCH', '/api/admin/appointments/:id', async ({ request, params }) => json(await s.updateAppointmentStatus.execute(id(params), (await readJson(request)).status)), admin);
  router.add('GET', '/api/admin/patients', async ({ query }) => json(await s.adminQueries.listPatients(Object.fromEntries(query))), admin);
  router.add('GET', '/api/admin/callbacks', async ({ query }) => json(await s.adminQueries.listCallbacks(Object.fromEntries(query))), admin);
  router.add('PATCH', '/api/admin/callbacks/:id/resolve', async ({ params }) => json(await s.resolveCallback.execute(id(params))), admin);
}
