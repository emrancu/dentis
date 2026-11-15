import { json, readJson } from '../../shared/http.js';

const admin = { admin: true };
const promptInput = (b) => ({ instructions: b.instructions, greeting: b.greeting, closing: b.closing });

/** How the voice agent speaks: persona, greeting and closing. */
export function registerAgentRoutes(router, s) {
  router.add('GET', '/api/admin/agent', async () => json(await s.agentSettings.get()), admin);
  router.add('PUT', '/api/admin/agent', async ({ request }) => json(await s.agentSettings.update(promptInput(await readJson(request)))), admin);
  router.add('POST', '/api/admin/agent/preview', async ({ request }) => json(await s.agentSettings.preview(promptInput(await readJson(request)))), admin);
}
