import { UnauthorizedError } from '../../domain/shared/errors.js';
import { COOKIE, registerAdminRoutes } from './admin-routes.js';
import { registerPublicRoutes } from './public-routes.js';
import { Router, errorResponse, json } from './router.js';

const cookieValue = (request, name) => request.headers.get('Cookie')?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

/** Builds the request handler from the wired services. */
export function createApp(services) {
  const router = new Router();
  registerPublicRoutes(router, services);
  registerAdminRoutes(router, services);

  async function requireAdmin(request) {
    if (!(await services.adminAuth.verify(cookieValue(request, COOKIE)))) throw new UnauthorizedError('unauthorized', 'Please log in.');
    // Cookies are SameSite=Strict; this header is a second guard for state-changing calls.
    if (request.method !== 'GET' && request.headers.get('X-Requested-With') !== 'dentis') throw new UnauthorizedError('csrf_rejected', 'Missing X-Requested-With header.');
  }

  return {
    async handle(request, execCtx = { waitUntil() {} }) {
      const url = new URL(request.url);
      const found = router.match(request.method, url.pathname);
      if (!found) return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
      try {
        if (found.route.admin) await requireAdmin(request);
        return await found.route.handler({ request, params: found.params, query: url.searchParams, waitUntil: (p) => execCtx.waitUntil(p) });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
