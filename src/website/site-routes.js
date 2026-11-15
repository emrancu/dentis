import { json } from '../shared/http.js';

/** The public data the landing page loads. */
export function registerSiteRoutes(router, s) {
  router.add('GET', '/api/public/site', async () => json(await s.getPublicSite.execute()));
}
