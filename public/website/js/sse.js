/** Parses server-sent events (`data: {json}` blocks) from a fetch body. */
export function parseSseBlocks(buffer) {
  const events = [];
  let rest = buffer;
  let end;
  while ((end = rest.indexOf('\n\n')) >= 0) {
    const data = rest.slice(0, end).split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    rest = rest.slice(end + 2);
    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // a broken block is skipped, the stream goes on
    }
  }
  return { events, rest };
}

/** Yields each event as it arrives. */
export async function* readEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = parseSseBlocks(buffer + decoder.decode(value, { stream: true }));
      buffer = parsed.rest;
      yield* parsed.events;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
