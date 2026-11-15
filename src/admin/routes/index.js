import { registerActivityRoutes } from './activity.js';
import { registerAgentRoutes } from './agent.js';
import { registerAuthRoutes } from './auth.js';
import { registerClinicRoutes } from './clinic.js';
import { registerDoctorRoutes } from './doctors.js';
import { registerKnowledgeRoutes } from './knowledge.js';

/** Everything under /api/admin. Routes marked `{ admin: true }` run the admin guard first. */
export function registerAdminRoutes(router, services) {
  registerAuthRoutes(router, services);
  registerActivityRoutes(router, services);
  registerKnowledgeRoutes(router, services);
  registerDoctorRoutes(router, services);
  registerAgentRoutes(router, services);
  registerClinicRoutes(router, services);
}
