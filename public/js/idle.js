/** How long a caller may stay silent: a gentle "are you there?" first, then the call ends. */
export const IDLE = Object.freeze({ nudgeAfterMs: 15000, hangupAfterMs: 30000 });

/**
 * Tracks silence on a call. Pure: the caller passes the clock in, so it is easy to test.
 * Silence counts from the caller's last words, or from the moment the agent last finished
 * a normal turn. The agent's own "are you there?" does not restart the clock.
 */
export class IdleWatch {
  #last;
  #nudged = false;

  constructor(now, config = IDLE) {
    this.config = config;
    this.#last = now;
  }

  /** The caller started speaking: the silence is over. */
  callerSpoke(now) {
    this.#last = now;
    this.#nudged = false;
  }

  /** The agent finished a turn (not the nudge): silence counts from now. */
  agentFinished(now) {
    if (!this.#nudged) this.#last = now;
  }

  /** Returns 'nudge' once per silence, 'hangup' when it has lasted too long, otherwise null. */
  check(now) {
    const idle = now - this.#last;
    if (idle >= this.config.hangupAfterMs) return 'hangup';
    if (idle >= this.config.nudgeAfterMs && !this.#nudged) {
      this.#nudged = true;
      return 'nudge';
    }
    return null;
  }
}
