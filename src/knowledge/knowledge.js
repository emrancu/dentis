import { ConflictError, NotFoundError } from '../shared/errors.js';
import { Skill, sameTitle } from './skill.js';

/** What the voice agent reads: enabled skills only. */
export class AgentKnowledge {
  constructor({ skills }) {
    this.skills = skills;
  }

  /** One enabled skill by exact title (the agent copies it from the list in its prompt). */
  async get({ title }) {
    const skill = (await this.skills.list()).find((s) => s.enabled && sameTitle(s.title, title));
    if (!skill) throw new NotFoundError('skill_not_found', 'No topic with that title. Pick a title from the list in the prompt. If none fits, hand over to a human.');
    return { found: true, skill: { title: skill.title, description: skill.description, content: skill.content } };
  }
}

/** Admin CRUD for skills. */
export class SkillCatalog {
  constructor({ skills, clock }) {
    Object.assign(this, { skills, clock });
  }

  list() {
    return this.skills.list();
  }

  async create(input) {
    const skill = new Skill({ ...input, updatedAt: this.clock.now().toISOString() });
    await this.#requireFreeTitle(skill.title, null);
    return this.skills.insert(skill);
  }

  async update(id, input) {
    await this.#require(id);
    const skill = new Skill({ ...input, id, updatedAt: this.clock.now().toISOString() });
    await this.#requireFreeTitle(skill.title, id);
    await this.skills.save(skill);
    return skill;
  }

  /** The agent looks skills up by title, so two skills must not share one. */
  async #requireFreeTitle(title, ownId) {
    if ((await this.skills.list()).some((s) => s.id !== ownId && sameTitle(s.title, title))) {
      throw new ConflictError('skill_title_taken', 'Another skill already has this title. Titles must be unique.');
    }
  }

  async remove(id) {
    await this.#require(id);
    await this.skills.remove(id);
  }

  async #require(id) {
    const skill = await this.skills.findById(id);
    if (!skill) throw new NotFoundError('skill_not_found', 'Skill not found.');
    return skill;
  }
}
