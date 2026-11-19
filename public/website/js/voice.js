import { APOLOGY_TEXT, NUDGE_TEXT, errorKindOf } from './call-messages.js';
import { IdleWatch } from './idle.js';
import { Pcm16Reader, PcmPlayer } from './pcm.js';
import { ScribeConnection } from './scribe.js';
import { SentenceChunker } from './sentences.js';
import { readEvents } from './sse.js';
import { TranscriptBuilder } from './transcript.js';

const END_PAUSE_MS = 700; // after the closing line finishes, before hanging up
const BARGE_IN_LEVEL = 0.04; // the caller's mic must carry real sound, so a faint echo transcript does not cut the agent off
const MAX_RECONNECTS = 3;
const MAX_FAILED_TURNS = 3;

/** Fails with a `kind` the UI maps to a message. */
const fail = (kind, cause) => Object.assign(new Error(kind), { kind, cause });
const post = (url, body, init = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init });

/**
 * One browser voice call with the Bangla agent.
 *
 * Ears: the microphone streams to ElevenLabs Scribe v3 Live (WebSocket, one-use token from our Worker).
 * Brain: each finished turn goes to POST /api/agent/turn (OpenAI mini + tools, streamed).
 * Mouth: every finished sentence is sent to POST /api/voice/speak (ElevenLabs, streamed PCM) and played at once.
 *
 * Events: `state` ({state, error}), `phase` ({phase}), `tick` ({seconds}).
 * States: idle, connecting, live, ended, error. Phases (while live): listening, thinking, speaking.
 */
export class BanglaCall extends EventTarget {
  state = 'idle';
  phase = 'listening';
  muted = false;
  intent = 'general';
  #mic;
  #ctx;
  #player;
  #scribe;
  #worklet;
  #analysers = {};
  #transcript = new TranscriptBuilder();
  #history = [];
  #callId;
  #maxSeconds = 300;
  #startedAt = 0;
  #timer;
  #endTimer;
  #finishing = false;
  #greeting = '';
  #closing = '';
  #idle = null;
  #endReason = 'hangup';
  #ending = false; // the closing line is playing: nothing may interrupt it
  #epoch = 0; // bumps on every barge-in, so a cancelled turn can never speak again
  #turn = null; // { abort, spoken } while the agent is thinking or speaking
  #speech = Promise.resolve();
  #failedTurns = 0;
  #reconnects = 0;

  /** Voice activity of both sides, 0..1, for the waveform. */
  levels() {
    return { user: this.#level('user'), agent: this.#level('agent') };
  }

  #level(side) {
    const analyser = this.#analysers[side];
    if (!analyser || this.state !== 'live') return 0;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }

  #set(state, error = null) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('state', { detail: { state, error } }));
  }

  #setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.dispatchEvent(new CustomEvent('phase', { detail: { phase } }));
  }

  /** @param {'booking'|'general'} intent booking goes straight to an appointment; general is an open call. */
  async start(intent = 'general') {
    if (this.state === 'connecting' || this.state === 'live') return;
    this.intent = intent;
    this.#reset();
    this.#set('connecting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorklet || !window.WebSocket) throw fail('unsupported');
      this.#mic = await this.#openMic();
      const session = await this.#createSession();
      this.#callId = session.call_id;
      this.#maxSeconds = session.max_seconds ?? 300;
      this.#greeting = session.greeting ?? '';
      this.#closing = session.closing ?? '';
      await this.#setUpAudio();
      await this.#listen(session.listen_url);
      this.#startedAt = Date.now();
      this.#idle = new IdleWatch(Date.now());
      this.#timer = setInterval(() => this.#tick(), 1000);
      this.#set('live');
      this.#setPhase('listening');
      if (this.#greeting) this.#say(this.#greeting, { record: true });
    } catch (error) {
      await this.#abort(error);
    }
  }

  async #openMic() {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (error) {
      throw fail(errorKindOf(error), error);
    }
  }

  async #createSession() {
    let response;
    try {
      response = await post('/api/session', {});
    } catch (error) {
      throw fail('session_failed', error);
    }
    if (response.status === 429) throw fail('rate_limited');
    if (response.status === 503) throw fail('not_configured');
    if (!response.ok) throw fail('session_failed');
    return response.json();
  }

  /** One AudioContext: the microphone goes to the worklet (and a meter), the agent's voice to the speakers (and a meter). */
  async #setUpAudio() {
    const ctx = (this.#ctx = new AudioContext());
    await ctx.resume();
    await ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));

    const source = ctx.createMediaStreamSource(this.#mic);
    this.#analysers.user = this.#analyser(source);
    this.#worklet = new AudioWorkletNode(ctx, 'mic-to-pcm');
    this.#worklet.port.onmessage = (e) => this.#scribe?.sendAudio(e.data);
    const silent = ctx.createGain(); // a worklet only runs when connected to the output
    silent.gain.value = 0;
    source.connect(this.#worklet).connect(silent).connect(ctx.destination);

    const agentOut = ctx.createGain();
    this.#analysers.agent = this.#analyser(agentOut);
    agentOut.connect(ctx.destination);
    this.#player = new PcmPlayer(ctx, agentOut);
  }

  #analyser(node) {
    const analyser = this.#ctx.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    return analyser;
  }

  /* ---------- ears ---------- */

  async #listen(url) {
    const scribe = new ScribeConnection();
    scribe.addEventListener('partial', (e) => this.#onPartial(e.detail.text));
    scribe.addEventListener('committed', (e) => this.#onCommitted(e.detail.text));
    scribe.addEventListener('close', () => this.#onListenClosed());
    scribe.addEventListener('error', () => scribe.close());
    try {
      await scribe.open(url);
    } catch (error) {
      throw fail('connection_failed', error);
    }
    this.#scribe = scribe;
  }

  /** The speech connection dropped: get a new one-use URL and carry on, a few times. */
  async #onListenClosed() {
    if (this.state !== 'live' || this.#finishing) return;
    if (this.#reconnects++ >= MAX_RECONNECTS) return this.#finish('error', 'dropped');
    try {
      await new Promise((r) => setTimeout(r, 400 * this.#reconnects));
      const response = await post('/api/voice/listen', { call_id: this.#callId });
      if (!response.ok) throw new Error('listen');
      await this.#listen((await response.json()).listen_url);
      this.#reconnects = 0;
    } catch {
      this.#onListenClosed();
    }
  }

  #onPartial(text) {
    if (!text) return;
    this.#idle?.callerSpoke(Date.now());
    // Barge-in: real sound from the caller while the agent thinks or speaks stops the agent at once.
    if (this.#turn && !this.#ending && this.#level('user') > BARGE_IN_LEVEL) this.#interrupt();
  }

  #onCommitted(text) {
    this.#idle?.callerStopped(Date.now());
    if (!text || this.state !== 'live' || this.#ending) return;
    if (this.#turn) this.#interrupt();
    this.#transcript.add('patient', text);
    this.#history.push({ role: 'user', content: text });
    this.#runTurn();
  }

  /* ---------- brain ---------- */

  async #runTurn() {
    const epoch = this.#epoch;
    const abort = new AbortController();
    const turn = (this.#turn = { abort, spoken: [], saved: false });
    const chunker = new SentenceChunker();
    const speak = (sentence) => {
      turn.spoken.push(sentence);
      this.#queueSpeech(sentence, epoch, abort.signal);
    };
    let endCall = false;
    this.#setPhase('thinking');
    try {
      const response = await post('/api/agent/turn', { call_id: this.#callId, intent: this.intent, messages: this.#history }, { signal: abort.signal });
      if (!response.ok) throw new Error(`turn ${response.status}`);
      for await (const event of readEvents(response.body)) {
        if (epoch !== this.#epoch) return;
        if (event.type === 'text') {
          this.#setPhase('speaking');
          chunker.push(event.delta).forEach(speak);
        } else if (event.type === 'messages') {
          this.#history.push(...event.messages);
          if (event.messages.some((m) => m.role === 'assistant' && !m.tool_calls)) turn.saved = true;
        } else if (event.type === 'end_call') endCall = true;
        else if (event.type === 'error') throw new Error(event.code);
      }
      chunker.flush().forEach(speak);
      await this.#speech;
      await this.#player.drained();
      if (epoch !== this.#epoch) return;
      this.#failedTurns = 0;
    } catch (error) {
      if (epoch !== this.#epoch || abort.signal.aborted) return;
      return this.#turnFailed(turn, epoch);
    }
    this.#finishTurn(turn);
    if (endCall) return this.#hangUpWithClosing('hangup');
    this.#setPhase('listening');
    this.#idle?.agentFinished(Date.now());
  }

  /** The brain failed: apologise, and give up only after repeated failures. */
  async #turnFailed(turn, epoch) {
    this.#finishTurn(turn);
    if (++this.#failedTurns >= MAX_FAILED_TURNS) return this.#finish('error', 'connection_failed');
    this.#say(APOLOGY_TEXT, { record: true, history: false });
    await this.#speech;
    await this.#player.drained();
    if (epoch === this.#epoch) this.#setPhase('listening');
  }

  /** Records what the agent said in this turn, once. If the reply was cut off, the history keeps only what was spoken. */
  #finishTurn(turn) {
    if (this.#turn === turn) this.#turn = null;
    if (turn.saved === 'done') return;
    const said = turn.spoken.join(' ');
    this.#transcript.add('agent', said);
    if (said && !turn.saved) this.#history.push({ role: 'assistant', content: said });
    turn.saved = 'done';
  }

  /** Stops the agent now: no more audio, no more text, and the turn is written down as far as it was spoken. */
  #interrupt() {
    const turn = this.#turn;
    this.#epoch++;
    turn?.abort.abort();
    this.#player?.stop();
    this.#speech = Promise.resolve();
    if (turn) this.#finishTurn(turn);
    this.#setPhase('listening');
  }

  /* ---------- mouth ---------- */

  /** Fetches the sentence's audio at once (in parallel with earlier ones) and plays it in order. */
  #queueSpeech(text, epoch, signal) {
    const audio = fetch('/api/voice/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_id: this.#callId, text }), signal }).catch(() => null);
    this.#speech = this.#speech.then(async () => {
      const response = await audio;
      if (!response?.ok || epoch !== this.#epoch) return;
      const reader = response.body.getReader();
      const pcm = new Pcm16Reader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || epoch !== this.#epoch) break;
          this.#player.push(pcm.feed(value));
        }
      } catch {
        // cut off by a barge-in or a network error: the next sentence still plays
      } finally {
        reader.cancel().catch(() => {});
      }
    });
  }

  /** Speaks scripted text (greeting, "are you there?", closing) outside the brain. */
  #say(text, { record = false, history = true } = {}) {
    const epoch = this.#epoch;
    if (record) {
      this.#transcript.add('agent', text);
      if (history) this.#history.push({ role: 'assistant', content: text });
    }
    this.#setPhase('speaking');
    this.#queueSpeech(text, epoch, new AbortController().signal);
    const done = this.#speech.then(() => this.#player.drained());
    done.then(() => {
      if (epoch === this.#epoch && !this.#turn && this.state === 'live' && !this.#ending) {
        this.#setPhase('listening');
        this.#idle?.agentFinished(Date.now());
      }
    });
    return done;
  }

  /** Says the closing line to the end, then hangs up. */
  async #hangUpWithClosing(reason, { interrupt = false } = {}) {
    if (this.#ending || this.#finishing) return;
    this.#ending = true;
    this.#endReason = reason;
    this.#idle = null;
    if (interrupt && this.#turn) this.#interrupt();
    this.#endTimer = setTimeout(() => this.#finish(reason), 15000); // only catches a closing that never plays
    if (this.#closing) await this.#say(this.#closing, { record: true, history: false });
    setTimeout(() => this.#finish(reason), END_PAUSE_MS);
  }

  #tick() {
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    this.dispatchEvent(new CustomEvent('tick', { detail: { seconds } }));
    if (seconds >= this.#maxSeconds + 10) return this.#finish('timeout'); // the closing did not play: stop anyway
    if (seconds >= this.#maxSeconds) return this.#hangUpWithClosing('timeout', { interrupt: true });
    const idle = this.#idle?.check(Date.now());
    if (idle === 'nudge' && !this.#turn) this.#say(NUDGE_TEXT, { record: true });
    if (idle === 'hangup') this.#hangUpWithClosing('idle');
  }

  toggleMute() {
    this.muted = !this.muted;
    this.#idle?.callerSpoke(Date.now()); // a deliberate mute is not silence to be cut off
    this.#mic?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }

  end() {
    return this.#finish('hangup');
  }

  /** Connection problems before or during the call. */
  async #abort(error) {
    const kind = errorKindOf(error);
    await this.#finish('error', kind, { silent: this.#callId === undefined });
  }

  async #finish(reason, errorKind = null, { silent = false } = {}) {
    if (this.#finishing || this.state === 'ended' || this.state === 'error') return;
    this.#finishing = true;
    clearInterval(this.#timer);
    clearTimeout(this.#endTimer);
    this.#epoch++;
    this.#turn?.abort.abort();
    if (this.#turn) this.#finishTurn(this.#turn);
    this.#teardown();
    if (this.#callId && !silent) await this.#report(reason);
    this.#finishing = false;
    this.#set(errorKind && reason === 'error' ? 'error' : 'ended', errorKind);
  }

  #teardown() {
    this.#scribe?.close();
    this.#player?.stop();
    this.#worklet?.disconnect();
    this.#mic?.getTracks().forEach((t) => t.stop());
    this.#ctx?.close().catch(() => {});
    this.#analysers = {};
  }

  async #report(reason) {
    const id = encodeURIComponent(this.#callId);
    try {
      await post(`/api/calls/${id}/finish`, { turns: this.#transcript.toTurns(), reason }, { keepalive: true });
    } catch {
      // The portal shows the call as incomplete if the report never arrives.
    }
  }

  /** Last-chance report when the page closes mid-call. */
  reportOnPageHide() {
    if (this.state !== 'live' || !this.#callId) return;
    const body = JSON.stringify({ turns: this.#transcript.toTurns(), reason: 'hangup' });
    navigator.sendBeacon(`/api/calls/${encodeURIComponent(this.#callId)}/finish`, new Blob([body], { type: 'application/json' }));
  }

  #reset() {
    Object.assign(this, { muted: false, phase: 'listening' });
    this.#callId = undefined;
    this.#ending = false;
    this.#idle = null;
    this.#endReason = 'hangup';
    this.#finishing = false;
    this.#turn = null;
    this.#epoch = 0;
    this.#speech = Promise.resolve();
    this.#history = [];
    this.#failedTurns = 0;
    this.#reconnects = 0;
    this.#transcript = new TranscriptBuilder();
    this.#analysers = {};
    this.#scribe = undefined;
  }
}
