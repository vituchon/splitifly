import { Identifiable, EntityNotExistsError } from './common.js';

export class EntitiesMemoryStorage<E extends Identifiable> {
  protected entitiesById: Map<number, E>;
  protected idSequence: number;

  constructor() {
    this.entitiesById = new Map<number, E>();
    this.idSequence = 0;
  }

  // TODO: enhace method by allowing to pass Map<number, E> or E[] as well
  async load( entityById: {[id: number]: E }) {
    if (!entityById || Object.keys(entityById).length === 0) {
      return;
    }
    for (const [id, entity] of Object.entries(entityById)) {
      this.entitiesById.set(Number(id), entity);
    }
    const maxId = Math.max(...Object.keys(entityById).map(Number), 0);
    this.idSequence = maxId
  }

  async getAll(): Promise<E[]> {
    return Array.from(this.entitiesById.values());
  }

  async getById(id: number): Promise<E> {
    const entity = this.entitiesById.get(id);
    if (!entity) {
      throw EntityNotExistsError;
    }
    return entity;
  }

  async save(entity: E): Promise<E> {
    const nextId = this.idSequence + 1;
    entity.id = nextId;
    this.entitiesById.set(nextId, entity);
    this.idSequence++;
    return entity;
  }

  async update(entity: E): Promise<E> {
    if (!this.entitiesById.has(entity.id)) {
      throw EntityNotExistsError;
    }
    this.entitiesById.set(entity.id, entity);
    return entity;
  }

  async delete(id: number): Promise<void> {
    this.entitiesById.delete(id);
  }
}