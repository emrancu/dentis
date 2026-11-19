import { esc } from '../../../shared/util.js';
import { head } from '../ui.js';

/** Short engineering overview for reviewers: one diagram, the rules in one place, what breaks, what is missing. */
export function howItWorksView(view) {
  const lanes = ['Browser', 'Worker', 'ElevenLabs · Gemini', 'D1'];
  const msgs = [ // [from, to, label, reply?]
    [0, 1, '1  start call'],
    [1, 2, '2  one-use listen token'],
    [1, 0, '3  token, greeting, closing', true],
    [0, 2, '4  mic audio → Bangla text (Scribe)'],
    [0, 1, '5  caller turn → /api/agent/turn'],
    [1, 2, '6  Gemini (or GPT mini) streams reply + tool calls'],
    [1, 3, '7  run tools, validate, read or write'],
    [1, 0, '8  reply text, sentence by sentence', true],
    [0, 2, '9  each sentence → ElevenLabs voice'],
    [2, 0, '10  streamed audio, played at once', true],
    [0, 1, '11  send transcript at hang-up'],
  ];
  const W = 900, left = 70, gap = 253, top = 52, row = 32;
  const x = (n) => left + n * gap;
  const H = top + msgs.length * row + 16;
  const svg = `<svg class="seq" viewBox="0 0 ${W} ${H}" role="img" aria-label="One call across browser, worker, speech and brain providers, and database">
    <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>
    ${lanes.map((l, n) => `<text x="${x(n)}" y="22" text-anchor="middle" class="seq-lane">${l}</text><line x1="${x(n)}" y1="32" x2="${x(n)}" y2="${H - 8}" class="seq-line"/>`).join('')}
    ${msgs.map(([a, b, label, back], k) => {
      const y = top + k * row, x1 = x(a), x2 = x(b);
      return `<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -4 : 4)}" y2="${y}" class="seq-msg${back ? ' back' : ''}" marker-end="url(#ah)"/><text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle" class="seq-text">${esc(label)}</text>`;
    }).join('')}
  </svg>`;

  const rules = [
    ['Facts come from code', 'The model asks 11 server tools, run on the server inside the turn. Prices, hours, slots and bookings come from D1 and are checked in the domain layer, so the agent cannot invent them.'],
    ['Knowledge is chosen by title', 'The prompt lists only the entry titles. The model picks the ones a question needs and fetches their details. Staff write each entry in one plain form, in English or Bangla.'],
    ['Numbers are spoken by the server', 'Every phone number is saved first and read back from the tool result as English digit words, so it is never said in Bangla and a wrong number is caught at once.'],
    ['The caller leads', 'The agent greets, then waits. It asks for a name only when the caller wants an appointment, and answers any question first. It speaks no caption text: the call panel is voice only.'],
    ['Persona is editable, rules are not', 'Staff edit tone, greeting and closing. Flow, safety and scope are code, added last, and win over the persona.'],
    ['Secrets stay on the server', 'The browser only gets a one-use speech token. The Gemini (or OpenAI) and ElevenLabs keys never leave the Worker, which also streams the voice audio.'],
    ['Bounded', 'A call ends at 5 minutes; silence gets a nudge at 25 s and a hang-up at 50 s. 10 calls per IP per hour.'],
  ];
  const breaks = [
    ['A provider key is missing or the session fails', 'Clear message and a retry panel. Call marked failed.'],
    ['Connection drops', 'The speech connection reconnects up to 3 times, then the transcript so far is saved.'],
    ['A tool fails', 'The agent is told to offer a human callback, so it cannot confirm a booking that did not happen.'],
    ['Slot taken meanwhile', 'The database rejects the second booking and the agent offers other times.'],
  ];
  const gaps = [
    'The transcript is built in the browser, so the server cannot verify it. No audio is stored.',
    'Tool calls are authorised only by the call id. Signing them to the session is the next hardening step.',
    'Staying on topic and refusing medical advice come from the prompt, so they are not guaranteed. Latency and Bangla quality of the brain model (Gemini by default when its key is set, else GPT mini) and the Bangla accent of the ElevenLabs voice are judged by ear, not measured.',
  ];
  // Every path a caller's sentence can take: what triggers it, which tools run, what the agent says, where it ends.
  const paths = [
    { tone: 'answer', title: 'A question the clinic can answer', trigger: 'Fees, hours, address, doctors, services, FAQs.', tools: 'get_skill (one call per topic) · get_clinic_info · list_doctors', says: 'Reads the knowledge titles in its prompt and decides which topics the question needs: usually one, sometimes two to four. Fetches only those, then answers from the results in short Bangla. Prices and hours are read, never recalled.', ends: 'Back to "anything else?". No title fits or nothing is found: it says so and goes to a human.' },
    { tone: 'book', title: 'Booking, change or cancel', trigger: '"I need an appointment", "move it to Sunday".', tools: 'check_availability → book / reschedule / cancel_appointment, save_patient_details', says: 'Asks one thing at a time, offers only real free slots, reads name, phone and time back.', ends: 'Confirms only after the tool says ok. Slot taken: offers other times.' },
    { tone: 'human', title: 'It cannot handle it: pass to a human', trigger: 'Emergency, complaint, asks for a person, no answer in the data, or a tool fails.', tools: 'request_human_callback (urgent = true for emergencies)', says: 'Stays calm, asks name, phone and what happened, then says: "the team will call you on this number".', ends: 'The request appears under Callbacks. Staff phone the caller and mark it done.' },
    { tone: 'off', title: 'Off topic or medical advice', trigger: 'Politics, small talk, "what medicine should I take?", "what is wrong with my tooth?"', tools: 'none', says: 'One polite line: it can only help with the clinic. No diagnosis, no medicine. Offers a booking instead.', ends: 'Returns to dental topics. Keeps the call short.' },
  ];
  const pathCard = (p) => `<div class="path path-${p.tone}"><h3>${esc(p.title)}</h3><dl><dt>When</dt><dd>${esc(p.trigger)}</dd><dt>Tools</dt><dd class="mono">${esc(p.tools)}</dd><dt>Agent says</dt><dd>${esc(p.says)}</dd><dt>Ends</dt><dd>${esc(p.ends)}</dd></dl></div>`;
  const list = (rows) => rows.map(([t, d]) => `<div class="eng-row"><strong>${esc(t)}</strong><span>${esc(d)}</span></div>`).join('');

  view.innerHTML = `${head('How the agent works', 'A one-page overview for engineering review')}
    <section class="card"><h2>One call, end to end</h2>${svg}
      <p class="muted diagram-note">Solid arrows are requests, dashed arrows are replies. The Worker runs interface, application, domain and infrastructure layers, with dependencies pointing inward.</p>
    </section>
    <section class="card" style="margin-top:16px"><h2>How the agent decides</h2>
      <div class="decide"><span class="decide-start">Caller speaks</span><span class="decide-arrow" aria-hidden="true">↓</span><span class="decide-q">The voice model picks one path. Every fact it says on any path must come from a tool result.</span></div>
      <div class="paths">${paths.map(pathCard).join('')}</div>
      <p class="muted diagram-note">Guard rails on every path: the safety and scope rules are locked in code and written last in the prompt. Tool inputs are validated again on the server. If a tool cannot answer, the agent hands over instead of guessing.</p>
    </section>
    <div class="grid two" style="margin-top:16px">
      <section class="card"><h2>Design rules</h2><div class="eng-list">${list(rules)}</div></section>
      <section class="card"><h2>If something breaks</h2><div class="eng-list">${list(breaks)}</div></section>
    </div>
    <section class="card" style="margin-top:16px"><h2>Known gaps</h2><ul class="gaps">${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>`;
}
