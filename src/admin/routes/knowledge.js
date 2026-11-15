import { TITLE_INDEX_CAP } from '../../knowledge/skill.js';
import { skillDto } from '../dto.js';
import { json, noContent, readJson } from '../../shared/http.js';

const admin = { admin: true };
const id = (params) => Number(params.id);
const skillInput = (b) => ({ title: b.title, description: b.description, content: b.content, kind: b.kind, enabled: b.enabled });

/** Agent knowledge: the entries the voice agent can look up. */
export function registerKnowledgeRoutes(router, s) {
  router.add('GET', '/api/admin/skills', async () => json({ items: (await s.skillCatalog.list()).map(skillDto), title_index_cap: TITLE_INDEX_CAP }), admin);
  router.add('POST', '/api/admin/skills', async ({ request }) => json(skillDto(await s.skillCatalog.create(skillInput(await readJson(request)))), 201), admin);
  router.add('PUT', '/api/admin/skills/:id', async ({ request, params }) => json(skillDto(await s.skillCatalog.update(id(params), skillInput(await readJson(request))))), admin);
  router.add('DELETE', '/api/admin/skills/:id', async ({ params }) => (await s.skillCatalog.remove(id(params)), noContent()), admin);
}
