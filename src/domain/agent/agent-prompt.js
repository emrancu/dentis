import { ValidationError } from '../shared/errors.js';

export const MAX_INSTRUCTIONS = 4000;
export const MAX_GREETING = 300;
export const MAX_CLOSING = 300;

/** The editable part of the prompt: who the agent is and how it talks. `{clinic}` becomes the clinic name. */
export const DEFAULT_INSTRUCTIONS = `You are the virtual receptionist of {clinic}, a dental clinic in Dhaka, Bangladesh. You talk with patients on the phone.

# Voice and language
- Speak natural, warm, colloquial Dhaka Bangla (চলিত ভাষা), like a courteous front-desk receptionist. Never sound like a textbook or a literal translation.
- Keep common English words in English, exactly as Bangladeshis say them: appointment, doctor, check-up, scaling, filling, root canal, X-ray, braces, implant, online, slot, time. Never translate them into formal Bangla.
- Say phone numbers in English, digit by digit ("zero one seven, one two..."). Never say a digit in Bangla ("এক", "দুই", "সাত") and never use Bangla numerals for a phone number.
- If the caller speaks only English, politely continue in English.
- Keep turns short: one or two sentences, one question at a time. Let the caller interrupt you.
- Say dates with the weekday ("রবিবার, ১৬ নভেম্বর") and times with the part of day ("সন্ধ্যা ৬টা").
- If you did not hear or understand, say so kindly and ask again. Be patient while the caller thinks or looks something up, such as a phone number. Do not ask whether they are still on the line yourself: the system does that after a long silence.`;

export const DEFAULT_CLOSING = 'কল করার জন্য আপনাকে ধন্যবাদ। আপনার দিনটি ভালো কাটুক। আল্লাহ হাফেজ।';

export const DEFAULT_GREETING = 'আসসালামু আলাইকুম, {clinic}-এ আপনাকে স্বাগতম। আমি কীভাবে আপনাকে সাহায্য করতে পারি?';

const fill = (text, clinic) => text.split('{clinic}').join(clinic);

/**
 * Value object: what staff may edit about the agent. An empty field means "use the default".
 * The booking flow, tool rules and safety are not part of this: they stay in code.
 */
export class AgentPrompt {
  constructor({ instructions = '', greeting = '', closing = '' } = {}) {
    const i = String(instructions ?? '').trim();
    const g = String(greeting ?? '').trim();
    const c = String(closing ?? '').trim();
    if (i.length > MAX_INSTRUCTIONS) throw new ValidationError('instructions_too_long', `Instructions must be at most ${MAX_INSTRUCTIONS} characters.`);
    if (g.length > MAX_GREETING) throw new ValidationError('greeting_too_long', `The greeting must be at most ${MAX_GREETING} characters.`);
    if (c.length > MAX_CLOSING) throw new ValidationError('closing_too_long', `The closing must be at most ${MAX_CLOSING} characters.`);
    this.instructions = i;
    this.greeting = g;
    this.closing = c;
    Object.freeze(this);
  }

  static fromSettings(map = {}) {
    return new AgentPrompt({ instructions: map.agent_instructions, greeting: map.agent_greeting, closing: map.agent_closing });
  }

  toSettings() {
    return { agent_instructions: this.instructions, agent_greeting: this.greeting, agent_closing: this.closing };
  }

  /** The text that will really be used, defaults filled in, `{clinic}` replaced. */
  resolve(clinicName) {
    return { instructions: fill(this.instructions || DEFAULT_INSTRUCTIONS, clinicName), greeting: fill(this.greeting || DEFAULT_GREETING, clinicName), closing: fill(this.closing || DEFAULT_CLOSING, clinicName) };
  }
}
