import { json, readJson, readOptionalJson } from '../shared/http.js';

/** The voice call started from the website: session, the agent's tool calls, and finishing. */
export function registerCallRoutes(router, s) {
  router.add('POST', '/api/session', async ({ request }) => {
    const { intent } = await readOptionalJson(request);
    const session = await s.startCall.execute({ ip: request.headers.get('CF-Connecting-IP'), intent });
    return json({ call_id: session.callId, client_secret: session.clientSecret, model: session.model, max_seconds: session.maxSeconds, greeting: session.greeting, closing: session.closing }, 201);
  });

  router.add('POST', '/api/agent/tools/:name', async ({ request, params }) => {
    const body = await readJson(request);
    return json(await s.toolExecutor.execute(params.name, body.args, body.call_id));
  });

  router.add('POST', '/api/calls/:id/finish', async ({ request, params }) => {
    const body = await readJson(request);
    const call = await s.finishCall.execute({ callId: params.id, turns: body.turns, reason: body.reason });
    return json({ status: call.status });
  });
}
