import { AgentPrompt, DEFAULT_CLOSING, DEFAULT_GREETING, DEFAULT_INSTRUCTIONS } from '../../domain/agent/agent-prompt.js';
import { ClinicProfile } from '../../domain/clinic/clinic-profile.js';
import { dhakaParts } from '../../domain/shared/time.js';
import { buildInstructions } from './prompt.js';

/** Staff-editable agent instructions, greeting and closing, stored in settings. */
export class AgentSettings {
  constructor({ settings, doctors, skills, clock }) {
    Object.assign(this, { settings, doctors, skills, clock });
  }

  /** The text the agent really uses (saved or default), with `{clinic}` left in so staff edit the template. */
  async get() {
    const saved = AgentPrompt.fromSettings(await this.settings.all());
    return {
      instructions: saved.instructions || DEFAULT_INSTRUCTIONS,
      greeting: saved.greeting || DEFAULT_GREETING,
      closing: saved.closing || DEFAULT_CLOSING,
      default_instructions: DEFAULT_INSTRUCTIONS,
      default_greeting: DEFAULT_GREETING,
      default_closing: DEFAULT_CLOSING,
    };
  }

  /** Blank text, or text identical to the default, is stored as empty so later default improvements still apply. */
  async update({ instructions, greeting, closing }) {
    const asStored = (value, fallback) => (String(value ?? '').trim() === fallback ? '' : value);
    const prompt = new AgentPrompt({ instructions: asStored(instructions, DEFAULT_INSTRUCTIONS), greeting: asStored(greeting, DEFAULT_GREETING), closing: asStored(closing, DEFAULT_CLOSING) });
    await this.settings.setMany(prompt.toSettings());
    return this.get();
  }

  /** The full prompt a new call would get with this (unsaved) text. Saves nothing. */
  async preview({ instructions, greeting, closing }) {
    const [map, doctors, skills] = await Promise.all([this.settings.all(), this.doctors.list(), this.skills.list()]);
    return {
      prompt: buildInstructions({
        profile: ClinicProfile.fromMap(map),
        doctors: doctors.filter((d) => d.active),
        skills,
        now: dhakaParts(this.clock.now()),
        agentPrompt: new AgentPrompt({ instructions, greeting, closing }),
      }),
    };
  }
}
