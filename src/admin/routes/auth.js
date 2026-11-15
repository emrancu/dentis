import { SESSION_SECONDS } from '../auth.js';
import { sessionCookie } from '../session.js';
import { json, noContent, readJson } from '../../shared/http.js';

export function registerAuthRoutes(router, s) {
  router.add('POST', '/api/admin/login', async ({ request }) => {
    const token = await s.adminAuth.login((await readJson(request)).access_key);
    return noContent({ 'Set-Cookie': sessionCookie(token, request, SESSION_SECONDS) });
  });
  router.add('POST', '/api/admin/logout', async ({ request }) => noContent({ 'Set-Cookie': sessionCookie('', request, 0) }), { admin: true });
  router.add('GET', '/api/admin/me', async () => json({ authenticated: true }), { admin: true });
}
