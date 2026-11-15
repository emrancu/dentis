/** Realtime data-channel messages we send, and parsing of the model's function calls. */

const sayExactly = (text, extra) => ({
  type: 'response.create',
  // A response-level instruction replaces the session prompt for that one reply, so the exact words must be in it.
  response: { instructions: `Say exactly the following to the caller, in the same language, and nothing else. ${extra}\n\n${text}` },
});

/** The scripted greeting, spoken as soon as the data channel opens. */
export const greetingMessage = (greeting) => sayExactly(greeting, 'Then wait for the caller.');

/** Answers end_call and then speaks the scripted closing line. Send it after the current response is done. */
export const closingMessages = (callId, closing) => [
  { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ ok: true }) } },
  sayExactly(closing, 'Do not ask anything and do not add anything.'),
];

export function toolCallFrom(event) {
  const item = event?.type === 'response.output_item.done' ? event.item : null;
  if (item?.type !== 'function_call' || !item.name || !item.call_id) return null;
  let args = {};
  try {
    args = item.arguments ? JSON.parse(item.arguments) : {};
  } catch {
    args = {};
  }
  return { name: item.name, callId: item.call_id, args };
}

export const toolOutputMessages = (callId, result) => [
  { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } },
  { type: 'response.create' },
];

/** Maps a failure to the message key shown to the visitor. */
export function errorKindOf(error) {
  if (error?.kind) return error.kind;
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'mic_denied';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'no_mic';
  return 'connection_failed';
}
