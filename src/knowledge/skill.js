import { ValidationError } from '../shared/errors.js';

export const SKILL_KINDS = Object.freeze(['service', 'faq', 'policy']);

/**
 * Entity: a piece of dental-clinic knowledge the voice agent can fetch by tool call
 * (a service, a price note, a policy, an FAQ…). The voice agent knows every enabled entry. None of it is shown on the website.
 */
export class Skill {
  constructor({ id = null, title, description, content = '', kind = 'service', enabled = true, updatedAt = null }) {
    const t = String(title ?? '').trim();
    const d = String(description ?? '').trim();
    if (t.length < 2 || t.length > 80) throw new ValidationError('skill_title_invalid', 'Title must be 2–80 characters.');
    if (d.length < 2 || d.length > 400) throw new ValidationError('skill_description_invalid', 'Description must be 2–400 characters.');
    if (String(content).length > 4000) throw new ValidationError('skill_content_too_long', 'Details must be at most 4000 characters.');
    if (!SKILL_KINDS.includes(kind)) throw new ValidationError('skill_kind_invalid', `Type must be one of: ${SKILL_KINDS.join(', ')}.`);
    Object.assign(this, { id, title: t, description: d, content: String(content).trim(), kind, enabled: Boolean(enabled), updatedAt });
  }
}

/** Titles are the lookup key for the agent, so compare them ignoring case and extra spaces. */
export const sameTitle = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** The titles shown to the agent in its prompt: every enabled skill, sorted. The agent picks from them and fetches the details with get_skill. */
export const enabledTitles = (skills) => skills.filter((s) => s.enabled).map((s) => s.title).sort((a, b) => a.localeCompare(b));
