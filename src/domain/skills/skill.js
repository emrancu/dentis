import { ValidationError } from '../shared/errors.js';

export const SKILL_KINDS = Object.freeze(['service', 'faq', 'policy']);
/** How many enabled titles the agent is shown in its prompt. Past this it searches instead. */
export const TITLE_INDEX_CAP = 40;

/**
 * Entity: a piece of dental-clinic knowledge the voice agent can fetch by tool call
 * (a service, a price note, a policy, an FAQ…). Only enabled `service` entries with `onWebsite` set appear on the website; the agent knows all enabled entries.
 */
export class Skill {
  constructor({ id = null, title, description, titleBn = '', descriptionBn = '', content = '', kind = 'service', keywords = '', enabled = true, onWebsite = true, updatedAt = null }) {
    const t = String(title ?? '').trim();
    const d = String(description ?? '').trim();
    const k = String(keywords ?? '').trim();
    const tb = String(titleBn ?? '').trim();
    const db = String(descriptionBn ?? '').trim();
    if (t.length < 2 || t.length > 80) throw new ValidationError('skill_title_invalid', 'Title must be 2–80 characters.');
    if (d.length < 2 || d.length > 400) throw new ValidationError('skill_description_invalid', 'Description must be 2–400 characters.');
    if (String(content).length > 4000) throw new ValidationError('skill_content_too_long', 'Details must be at most 4000 characters.');
    if (!SKILL_KINDS.includes(kind)) throw new ValidationError('skill_kind_invalid', `Type must be one of: ${SKILL_KINDS.join(', ')}.`);
    if (tb.length > 80) throw new ValidationError('skill_title_bn_too_long', 'The Bangla title must be at most 80 characters.');
    if (db.length > 400) throw new ValidationError('skill_description_bn_too_long', 'The Bangla description must be at most 400 characters.');
    if (k.length > 300) throw new ValidationError('skill_keywords_too_long', 'Keywords must be at most 300 characters.');
    Object.assign(this, { id, title: t, description: d, titleBn: tb, descriptionBn: db, content: String(content).trim(), kind, keywords: k, enabled: Boolean(enabled), onWebsite: Boolean(onWebsite), updatedAt });
  }
}

/** Titles are the lookup key for the agent, so compare them ignoring case and extra spaces. */
export const sameTitle = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * The titles shown to the agent: enabled skills, sorted. `overCap` is true when there are too many to list,
 * in which case the list is empty and the agent must search.
 */
export function titleIndex(skills, cap = TITLE_INDEX_CAP) {
  const titles = skills.filter((s) => s.enabled).map((s) => s.title).sort((a, b) => a.localeCompare(b));
  return titles.length > cap ? { overCap: true, titles: [] } : { overCap: false, titles };
}

// Words that say nothing about which skill the caller means.
const STOPWORDS = new Set(['the', 'is', 'do', 'you', 'for', 'my', 'to', 'of', 'can', 'how', 'much', 'what', 'does', 'are', 'and', 'have', 'কত', 'কি', 'কী', 'আমি', 'আমার', 'আছে', 'হয়', 'করে', 'করতে', 'চাই', 'আপনাদের', 'কোথায়']);
const tokenize = (s) => String(s ?? '').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((x) => x.length >= 2 && !STOPWORDS.has(x));

/**
 * Does the field mention the query word? Besides a plain substring match, a query word that starts with a
 * word of the field counts too, so Bangla endings still match: "তোলার" finds "তোলা", "বাচ্চাদের" finds "বাচ্চা".
 */
const mentions = (text, words, token) => text.includes(token) || words.some((w) => w.length >= 3 && token.startsWith(w));

/** Domain service: rank enabled skills against a free-text query (Bangla or English). */
export function rankSkills(skills, query, limit = 3) {
  const q = String(query ?? '').trim().toLowerCase();
  const tokens = tokenize(q);
  if (!tokens.length) return [];
  const scored = skills.filter((s) => s.enabled).map((s) => {
    const [title, words, desc, body, titleBn, descBn] = [s.title, s.keywords, s.description, s.content, s.titleBn, s.descriptionBn].map((f) => {
      const text = String(f ?? '').toLowerCase();
      return { text, words: tokenize(text) };
    });
    let score = (title.text.includes(q) || (titleBn.text && titleBn.text.includes(q)) ? 10 : 0) + (words.text.includes(q) ? 8 : 0);
    for (const t of tokens) {
      if (mentions(title.text, title.words, t) || mentions(titleBn.text, titleBn.words, t)) score += 5;
      if (mentions(words.text, words.words, t)) score += 4;
      if (mentions(desc.text, desc.words, t) || mentions(descBn.text, descBn.words, t)) score += 3;
      if (mentions(body.text, body.words, t)) score += 1;
    }
    return { skill: s, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.skill);
}
