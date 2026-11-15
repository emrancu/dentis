import { registerAdminRoutes } from './admin/routes/index.js';
import { adminGuard } from './admin/session.js';
import { Router, errorResponse, json } from './shared/http.js';
import { registerWebsiteRoutes } from './website/routes.js';

/** Builds the request handler from the wired services: the website routes and the admin routes. */
export function createApp(services, { assets = null } = {}) {
  const router = new Router();
  registerWebsiteRoutes(router, services, { assets });
  registerAdminRoutes(router, services);
  const requireAdmin = adminGuard(services);

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
