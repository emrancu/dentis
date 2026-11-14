import { ValidationError } from '../shared/errors.js';

/**
 * Entity: a piece of dental-clinic knowledge the voice agent can fetch by tool call
 * (a service, a price note, a policy, an FAQ…).
 */
export class Skill {
  constructor({ id = null, title, description, content = '', enabled = true, updatedAt = null }) {
    const t = String(title ?? '').trim();
    const d = String(description ?? '').trim();
    if (t.length < 2 || t.length > 80) throw new ValidationError('skill_title_invalid', 'Title must be 2–80 characters.');
    if (d.length < 2 || d.length > 400) throw new ValidationError('skill_description_invalid', 'Description must be 2–400 characters.');
    if (String(content).length > 4000) throw new ValidationError('skill_content_too_long', 'Details must be at most 4000 characters.');
    Object.assign(this, { id, title: t, description: d, content: String(content).trim(), enabled: Boolean(enabled), updatedAt });
  }
}

const tokenize = (s) => String(s ?? '').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((x) => x.length >= 2);

/** Domain service: rank enabled skills against a free-text query (Bangla or English). */
export function rankSkills(skills, query, limit = 3) {
  const q = String(query ?? '').trim().toLowerCase();
  const tokens = tokenize(q);
  if (!tokens.length) return [];
  const scored = skills.filter((s) => s.enabled).map((s) => {
    const title = s.title.toLowerCase();
    const desc = s.description.toLowerCase();
    const body = s.content.toLowerCase();
    let score = title.includes(q) ? 10 : 0;
    for (const t of tokens) {
      if (title.includes(t)) score += 5;
      if (desc.includes(t)) score += 3;
      if (body.includes(t)) score += 1;
    }
    return { skill: s, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.skill);
}
