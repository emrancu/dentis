import { errorKindOf, sessionUpdateGreeting, toolCallFrom, toolOutputMessages } from './call-messages.js';
import { TranscriptBuilder } from './transcript.js';

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const END_FALLBACK_MS = 6000;

/** Fails with a `kind` the UI maps to a message. */
const fail = (kind, cause) => Object.assign(new Error(kind), { kind, cause });

/**
 * One browser voice call with the Bangla agent.
 * Events: `state` ({state, error}), `caption` ({text}), `tick` ({seconds}).
 * States: idle, connecting, live, ended, error.
 */
export class BanglaCall extends EventTarget {
  state = 'idle';
  muted = false;
  intent = 'general';
  #pc;
  #dc;
  #mic;
  #audio;
  #audioCtx;
  #analysers = {};
  #recorder;
  #chunks = [];
  #transcript = new TranscriptBuilder();
  #callId;
  #maxSeconds = 300;
  #startedAt = 0;
  #timer;
  #endTimer;
  #finishing = false;
  #pendingEnd = false;

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

  /** @param {'booking'|'general'} intent booking goes straight to an appointment; general is an open call. */
  async start(intent = 'general') {
    if (this.state === 'connecting' || this.state === 'live') return;
    this.intent = intent;
    this.#reset();
    this.#set('connecting');
    try {
      this.#mic = await this.#openMic();
      const session = await this.#createSession();
      this.#callId = session.call_id;
      this.#maxSeconds = session.max_seconds ?? 300;
      await this.#connect(session.client_secret);
    } catch (error) {
      await this.#abort(error);
    }
  }

  async #openMic() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw fail('unsupported');
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (error) {
      throw fail(errorKindOf(error), error);
    }
  }

  async #createSession() {
    let response;
    try {
      response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: this.intent }) });
    } catch (error) {
      throw fail('session_failed', error);
    }
    if (response.status === 429) throw fail('rate_limited');
    if (!response.ok) throw fail('session_failed');
    return response.json();
  }

  async #connect(secret) {
    const pc = (this.#pc = new RTCPeerConnection());
    this.#audio = new Audio();
    this.#audio.autoplay = true;
    this.#audioCtx = new AudioContext();

    pc.ontrack = (e) => {
      this.#audio.srcObject = e.streams[0];
      this.#tap('agent', e.streams[0]);
      this.#startRecording(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (this.state === 'live' && ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.#finish('error', 'dropped');
    };
    this.#mic.getTracks().forEach((t) => pc.addTrack(t, this.#mic));
    this.#tap('user', this.#mic);

    const dc = (this.#dc = pc.createDataChannel('oai-events'));
    dc.onmessage = (e) => this.#onMessage(e.data);
    dc.onopen = () => {
      this.#startedAt = Date.now();
      this.#timer = setInterval(() => this.#tick(), 1000);
      this.#set('live');
      this.#send(sessionUpdateGreeting());
    };

    await pc.setLocalDescription(await pc.createOffer());
    let answer;
    try {
      answer = await fetch(REALTIME_CALLS_URL, { method: 'POST', body: pc.localDescription.sdp, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' } });
    } catch (error) {
      throw fail('connection_failed', error);
    }
    if (!answer.ok) throw fail('connection_failed');
    await pc.setRemoteDescription({ type: 'answer', sdp: await answer.text() });
  }

  #tap(side, stream) {
    const analyser = this.#audioCtx.createAnalyser();
    analyser.fftSize = 512;
    this.#audioCtx.createMediaStreamSource(stream).connect(analyser);
    this.#analysers[side] = analyser;
  }

  /** Records both sides mixed, so staff can listen back. Best effort: failures never affect the call. */
  #startRecording(remote) {
    try {
      const mix = this.#audioCtx.createMediaStreamDestination();
      this.#audioCtx.createMediaStreamSource(remote).connect(mix);
      this.#audioCtx.createMediaStreamSource(this.#mic).connect(mix);
      this.#recorder = new MediaRecorder(mix.stream);
      this.#recorder.ondataavailable = (e) => e.data.size && this.#chunks.push(e.data);
      this.#recorder.start(2000);
    } catch {
      this.#recorder = null;
    }
  }

  #send(message) {
    if (this.#dc?.readyState === 'open') this.#dc.send(JSON.stringify(message));
  }

  #tick() {
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    this.dispatchEvent(new CustomEvent('tick', { detail: { seconds } }));
    if (seconds >= this.#maxSeconds) this.#finish('timeout');
  }

  #onMessage(data) {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    if (this.#transcript.handle(event)) this.dispatchEvent(new CustomEvent('caption', { detail: { text: this.#transcript.lastAgentText() } }));
    if (event.type === 'output_audio_buffer.stopped' && this.#pendingEnd) {
      clearTimeout(this.#endTimer);
      this.#endTimer = setTimeout(() => this.#finish('hangup'), 700);
    }
    const call = toolCallFrom(event);
    if (call) this.#runTool(call);
  }

  async #runTool({ name, callId, args }) {
    let result;
    try {
      const response = await fetch(`/api/agent/tools/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: this.#callId, args }),
      });
      result = response.ok ? await response.json() : { ok: false, error: 'tool_unavailable', message: 'The system could not do that right now. Offer a human callback.' };
    } catch {
      result = { ok: false, error: 'tool_unavailable', message: 'The system could not do that right now. Offer a human callback.' };
    }
    if (name === 'end_call') {
      // The goodbye is already spoken; hang up once the audio has played out.
      this.#pendingEnd = true;
      this.#endTimer = setTimeout(() => this.#finish('hangup'), END_FALLBACK_MS);
      return;
    }
    toolOutputMessages(callId, result).forEach((m) => this.#send(m));
  }

  toggleMute() {
    this.muted = !this.muted;
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
    const recording = await this.#stopRecording();
    this.#teardown();
    if (this.#callId && !silent) await this.#report(reason, recording);
    this.#finishing = false;
    this.#set(errorKind && reason === 'error' ? 'error' : 'ended', errorKind);
  }

  async #stopRecording() {
    const recorder = this.#recorder;
    if (!recorder || recorder.state === 'inactive') return null;
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;
    return this.#chunks.length ? new Blob(this.#chunks, { type: recorder.mimeType || 'audio/webm' }) : null;
  }

  #teardown() {
    this.#dc?.close();
    this.#pc?.close();
    this.#mic?.getTracks().forEach((t) => t.stop());
    this.#audio && (this.#audio.srcObject = null);
    this.#audioCtx?.close().catch(() => {});
    this.#analysers = {};
  }

  async #report(reason, recording) {
    const id = encodeURIComponent(this.#callId);
    try {
      await fetch(`/api/calls/${id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: this.#transcript.toTurns(), reason }),
        keepalive: true,
      });
      if (recording) await fetch(`/api/calls/${id}/recording`, { method: 'PUT', headers: { 'Content-Type': recording.type.split(';')[0] }, body: recording });
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
    Object.assign(this, { muted: false });
    this.#callId = undefined;
    this.#chunks = [];
    this.#recorder = null;
    this.#pendingEnd = false;
    this.#finishing = false;
    this.#transcript = new TranscriptBuilder();
    this.#analysers = {};
  }
}
