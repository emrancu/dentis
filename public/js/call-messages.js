/** Realtime data-channel messages we send, and parsing of the model's function calls. */

export const sessionUpdateGreeting = () => ({
  type: 'response.create',
  response: { instructions: 'Greet the caller now with the scripted greeting from your instructions, in natural Bangla. Then wait.' },
});

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
