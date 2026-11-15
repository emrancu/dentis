import { ValidationError } from '../../domain/shared/errors.js';
import { json, noContent, readJson, readOptionalJson } from './router.js';

const MAX_RECORDING_BYTES = 10 * 1024 * 1024;

export function registerPublicRoutes(router, s) {
  router.add('GET', '/api/public/site', async () => json(await s.getPublicSite.execute()));

  router.add('POST', '/api/session', async ({ request }) => {
    const { intent } = await readOptionalJson(request);
    const session = await s.startCall.execute({ ip: request.headers.get('CF-Connecting-IP'), intent });
    return json({ call_id: session.callId, client_secret: session.clientSecret, model: session.model, max_seconds: session.maxSeconds }, 201);
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

  router.add('PUT', '/api/calls/:id/recording', async ({ request, params }) => {
    const body = await request.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_RECORDING_BYTES) throw new ValidationError('recording_size_invalid', 'Recording must be between 1 byte and 10 MB.');
    await s.storeRecording.execute({ callId: params.id, body, contentType: request.headers.get('Content-Type') });
    return noContent();
  });
}
