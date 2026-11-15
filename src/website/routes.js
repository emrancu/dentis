import { registerCallRoutes } from './call-routes.js';
import { registerHomeRoute } from './home.js';
import { registerSiteRoutes } from './site-routes.js';

/** Everything the public website uses. `assets` serves the static files; the Worker renders "/" itself so the SEO tags are in the HTML. */
export function registerWebsiteRoutes(router, services, { assets = null } = {}) {
  registerSiteRoutes(router, services);
  registerCallRoutes(router, services);
  if (assets) registerHomeRoute(router, services, assets);
}
