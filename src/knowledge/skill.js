import { ValidationError } from '../shared/errors.js';

/**
 * Entity: a piece of dental-clinic knowledge (a service, a price, a policy, an FAQ…): a title and its details.
 * The agent sees every enabled title and fetches the details of the ones a question needs. None of it is shown on the website.
 */
export class Skill {
  constructor({ id = null, title, content, enabled = true, updatedAt = null }) {
    const t = String(title ?? '').trim();
    const c = String(content ?? '').trim();
    if (t.length < 2 || t.length > 80) throw new ValidationError('skill_title_invalid', 'Title must be 2–80 characters.');
    if (!c) throw new ValidationError('skill_content_required', 'Write the details the agent should say.');
    if (c.length > 4000) throw new ValidationError('skill_content_too_long', 'Details must be at most 4000 characters.');
    Object.assign(this, { id, title: t, content: c, enabled: Boolean(enabled), updatedAt });
  }
}

/** Titles are the lookup key for the agent, so compare them ignoring case and extra spaces. */
export const sameTitle = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** The titles shown to the agent in its prompt: every enabled skill, sorted. The agent picks from them and fetches the details with get_skill. */
export const enabledTitles = (skills) => skills.filter((s) => s.enabled).map((s) => s.title).sort((a, b) => a.localeCompare(b));
