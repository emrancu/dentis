/** Maps a failure to the message key shown to the visitor. */
export function errorKindOf(error) {
  if (error?.kind) return error.kind;
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'mic_denied';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'no_mic';
  return 'connection_failed';
}

/** The "are you there?" prompt after a long silence, and the apology when the brain fails a turn. */
export const NUDGE_TEXT = 'হ্যালো, আপনি কি লাইনে আছেন?';
export const APOLOGY_TEXT = 'দুঃখিত, একটু সমস্যা হচ্ছে। আপনি কি আবার বলবেন?';
