import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Pcm16Reader, PcmPlayer } from '../../public/website/js/pcm.js';
import { audioChunkMessage, parseScribeMessage } from '../../public/website/js/scribe.js';
import { SentenceChunker } from '../../public/website/js/sentences.js';
import { parseSseBlocks, readEvents } from '../../public/website/js/sse.js';

const speak = (text) => {
  const c = new SentenceChunker();
  return [...c.push(text), ...c.flush()];
};

describe('SentenceChunker', () => {
  it('ends a sentence at a danda, a question mark or an exclamation mark at once', () => {
    const c = new SentenceChunker();
    assert.deepEqual(c.push('জি, বলুন।'), ['জি, বলুন।']);
    assert.deepEqual(c.push('আপনার নাম কী?'), ['আপনার নাম কী?']);
  });

  it('waits for the rest of a sentence that arrives word by word', () => {
    const c = new SentenceChunker();
    assert.deepEqual(c.push('আপনার '), []);
    assert.deepEqual(c.push('নাম '), []);
    assert.deepEqual(c.push('বলুন। এবার'), ['আপনার নাম বলুন।']);
    assert.deepEqual(c.flush(), ['এবার']);
  });

  it('does not split a time or a decimal, but does split "." followed by a space', () => {
    assert.deepEqual(speak('সময় 10.30 টায়। ঠিক আছে'), ['সময় 10.30 টায়।', 'ঠিক আছে']);
    assert.deepEqual(speak('Okay. Next one'), ['Okay.', 'Next one']);
  });

  it('keeps "?!" together and drops empty pieces', () => {
    assert.deepEqual(speak('সত্যি?! হ্যাঁ।'), ['সত্যি?!', 'হ্যাঁ।']);
    assert.deepEqual(speak('   '), []);
  });

  it('cuts a very long run without punctuation at a space, under the speech limit', () => {
    const long = Array(200).fill('শব্দ').join(' ');
    const parts = speak(long);
    assert.ok(parts.length > 1);
    assert.ok(parts.every((p) => p.length <= 400));
    assert.equal(parts.join(' '), long);
  });
});

describe('SentenceChunker: first clause', () => {
  it('speaks the first piece of a reply at its first comma once it is long enough, then whole sentences', () => {
    const c = new SentenceChunker();
    assert.deepEqual(c.push('আমাদের ক্লিনিক শনিবার থেকে বৃহস্পতিবার, '), ['আমাদের ক্লিনিক শনিবার থেকে বৃহস্পতিবার,']);
    assert.deepEqual(c.push('সকাল ১০টা থেকে রাত ৮টা, শুক্রবার বন্ধ।'), ['সকাল ১০টা থেকে রাত ৮টা, শুক্রবার বন্ধ।']);
  });

  it('does not cut a very short start such as "জি, " into its own piece', () => {
    const c = new SentenceChunker();
    assert.deepEqual(c.push('জি, '), []);
    assert.deepEqual(c.push('বলুন।'), ['জি, বলুন।']);
  });

  it('waits for the space after the comma, so a number like 1,200 is never cut', () => {
    const c = new SentenceChunker();
    assert.deepEqual(c.push('স্কেলিং এর খরচ হচ্ছে 1,200 টাকা'), []);
  });

  it('only the first piece is split early', () => {
    const c = new SentenceChunker();
    c.push('আমাদের ক্লিনিক শনিবার থেকে বৃহস্পতিবার, ');
    assert.deepEqual(c.push('প্রথম অংশ, দ্বিতীয় অংশ, তৃতীয় অংশ। '), ['প্রথম অংশ, দ্বিতীয় অংশ, তৃতীয় অংশ।']);
  });
});

describe('server-sent events', () => {
  it('parses complete blocks and keeps the unfinished rest', () => {
    const { events, rest } = parseSseBlocks('data: {"type":"text","delta":"a"}\n\ndata: {"type":"do');
    assert.deepEqual(events, [{ type: 'text', delta: 'a' }]);
    assert.equal(rest, 'data: {"type":"do');
  });

  it('skips a broken block and goes on', () => {
    assert.deepEqual(parseSseBlocks('data: {oops\n\ndata: {"type":"done"}\n\n').events, [{ type: 'done' }]);
  });

  it('reads events from a body even when they are split across chunks', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode('data: {"type":"te'));
        c.enqueue(enc.encode('xt","delta":"জি"}\n\ndata: {"type":"done"}\n\n'));
        c.close();
      },
    });
    const seen = [];
    for await (const e of readEvents(body)) seen.push(e.type);
    assert.deepEqual(seen, ['text', 'done']);
  });
});

describe('Pcm16Reader', () => {
  it('decodes little-endian 16-bit samples to floats', () => {
    const out = new Pcm16Reader().feed(new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0xc0]));
    assert.deepEqual([...out], [0, 0.5, -0.5]);
  });

  it('holds a lone byte at the end of a chunk until the next chunk completes the sample', () => {
    const r = new Pcm16Reader();
    assert.equal(r.feed(new Uint8Array([0x00, 0x40, 0x00])).length, 1);
    assert.deepEqual([...r.feed(new Uint8Array([0x40]))], [0.5]);
  });

  it('works on a view into a bigger buffer', () => {
    const big = new Uint8Array([9, 9, 0x00, 0x40, 9]);
    assert.deepEqual([...new Pcm16Reader().feed(big.subarray(2, 4))], [0.5]);
  });
});

describe('PcmPlayer', () => {
  const fakeContext = () => {
    const sources = [];
    return {
      sources,
      currentTime: 0,
      createBuffer: (_c, length, rate) => ({ duration: length / rate, copyToChannel() {} }),
      createBufferSource: () => {
        const s = { connect() {}, start(at) { s.at = at; }, stop() { s.stopped = true; } };
        sources.push(s);
        return s;
      },
    };
  };

  it('plays chunks back to back with a small lead, and tells when it has drained', async () => {
    const ctx = fakeContext();
    const p = new PcmPlayer(ctx, {});
    p.push(new Float32Array(2400)); // 0.1 s
    p.push(new Float32Array(2400));
    assert.ok(ctx.sources[0].at > 0);
    assert.ok(Math.abs(ctx.sources[1].at - (ctx.sources[0].at + 0.1)) < 1e-9);
    let drained = false;
    p.drained().then(() => (drained = true));
    ctx.sources.forEach((s) => s.onended());
    await Promise.resolve();
    assert.equal(drained, true);
  });

  it('drained() is immediate when nothing plays', async () => {
    await new PcmPlayer(fakeContext(), {}).drained();
  });

  it('stop() silences every source at once, forgets the queue and releases waiters', async () => {
    const ctx = fakeContext();
    const p = new PcmPlayer(ctx, {});
    p.push(new Float32Array(2400));
    p.push(new Float32Array(2400));
    const waiting = p.drained();
    p.stop();
    await waiting;
    assert.equal(p.playing, false);
    assert.ok(ctx.sources.every((s) => s.stopped));
    p.push(new Float32Array(2400)); // after a barge-in the next reply starts fresh
    assert.ok(ctx.sources[2].at < 0.5);
  });
});

describe('Scribe messages', () => {
  it('maps partial, committed and ready messages', () => {
    assert.deepEqual(parseScribeMessage('{"message_type":"session_started"}'), { type: 'ready' });
    assert.deepEqual(parseScribeMessage('{"message_type":"partial_transcript","text":" আমি "}'), { type: 'partial', text: 'আমি' });
    assert.deepEqual(parseScribeMessage('{"message_type":"committed_transcript","text":"আমি চাই"}'), { type: 'committed', text: 'আমি চাই' });
  });

  it('flags errors, and ignores other messages and bad JSON', () => {
    assert.equal(parseScribeMessage('{"message_type":"auth_error","error":"bad token"}').type, 'error');
    assert.equal(parseScribeMessage('{"message_type":"quota_exceeded"}').type, 'error');
    assert.equal(parseScribeMessage('{"message_type":"committed_transcript_with_timestamps","text":"x"}').type, 'other');
    assert.equal(parseScribeMessage('not json').type, 'other');
  });

  it('wraps 16 kHz audio as base64 in an input_audio_chunk', () => {
    const m = audioChunkMessage(new Int16Array([1, 2]));
    assert.deepEqual([m.message_type, m.commit, m.sample_rate], ['input_audio_chunk', false, 16000]);
    assert.equal(m.audio_base_64, 'AQACAA==');
  });
});
