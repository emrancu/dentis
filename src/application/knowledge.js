import { NotFoundError } from '../domain/shared/errors.js';
import { Skill, rankSkills } from '../domain/skills/skill.js';

/** What the voice agent reads: enabled skills only. */
export class AgentKnowledge {
  constructor({ skills }) {
    this.skills = skills;
  }

  async list() {
    return (await this.skills.list()).filter((s) => s.enabled).map((s) => ({ title: s.title, description: s.description }));
  }

  async lookup({ query }) {
    const found = rankSkills(await this.skills.list(), query);
    return { found: found.length > 0, skills: found.map((s) => ({ title: s.title, description: s.description, content: s.content })) };
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
    return this.skills.insert(new Skill({ ...input, updatedAt: this.clock.now().toISOString() }));
  }

  async update(id, input) {
    await this.#require(id);
    const skill = new Skill({ ...input, id, updatedAt: this.clock.now().toISOString() });
    await this.skills.save(skill);
    return skill;
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
