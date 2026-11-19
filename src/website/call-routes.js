import { json, readJson } from '../shared/http.js';

/** The voice call started from the website: session, the agent's tool calls, and finishing. */
export function registerCallRoutes(router, s) {
  router.add('POST', '/api/session', async ({ request }) => {
    const session = await s.startCall.execute({ ip: request.headers.get('CF-Connecting-IP') });
    return json({ call_id: session.callId, listen_url: session.listenUrl, max_seconds: session.maxSeconds, greeting: session.greeting, closing: session.closing }, 201);
  });

  // One turn of the conversation, streamed as server-sent events: text to speak, new history, end of call.
  router.add('POST', '/api/agent/turn', async ({ request }) => {
    const body = await readJson(request);
    const turn = await s.runAgentTurn.start({ callId: body.call_id, messages: body.messages, intent: body.intent });
    const abort = new AbortController();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          for await (const event of s.runAgentTurn.events(turn, abort.signal)) send(event);
          send({ type: 'done' });
        } catch (error) {
          if (!abort.signal.aborted) {
            console.error(error);
            send({ type: 'error', code: 'brain_failed' });
          }
        }
        try {
          controller.close();
        } catch {
          // the browser already hung up on this turn (barge-in)
        }
      },
      cancel: () => abort.abort(),
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
  });

  // One sentence of speech: raw PCM streamed straight from ElevenLabs.
  router.add('POST', '/api/voice/speak', async ({ request }) => {
    const body = await readJson(request);
    const upstream = await s.synthesizeSpeech.execute({ callId: body.call_id, text: body.text, signal: request.signal });
    return new Response(upstream.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
  });

  // The speech connection dropped mid-call: a new one-use URL.
  router.add('POST', '/api/voice/listen', async ({ request }) => {
    const body = await readJson(request);
    return json({ listen_url: await s.renewListenUrl.execute({ callId: body.call_id }) });
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
