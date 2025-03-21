import { Identifiable, EntityNotExistsError, Collection, EntitiesRepository } from './common';

export class EntitiesMemoryStorage<E extends Identifiable> implements EntitiesRepository<E>{
  protected entityById: Map<number, E>;
  protected idSequence: number;

  constructor() {
    this.entityById = new Map<number, E>();
    this.idSequence = 0;
  }

  async init(data: {[id: number]: E}): Promise<void>;
  async init(data: Map<number, E>): Promise<void>;
  async init(data: E[]): Promise<void>;
  async init(data: Collection<E>): Promise<void> {
      if (!data) {
        return
      }
      if (Array.isArray(data)) {
          await this.loadFromArray(data);
      } else if (data instanceof Map) {
          await this.loadFromMap(data);
      } else {
          await this.loadFromObject(data);
      }
  }

  private async loadFromArray(entities: E[]) {
      let nextId = this.idSequence + 1;
      for (const entity of entities) {
          this.entityById.set(nextId++, entity);
      }
      this.idSequence = nextId - 1;
  }

  private async loadFromMap(entityById: Map<number, E>) {
      for (const [id, entity] of entityById.entries()) {
          this.entityById.set(id, entity);
      }
      const maxId = Math.max(...Array.from(entityById.keys()), this.idSequence);
      this.idSequence = maxId;
  }

  public async loadFromObject(entityById: {[id: number]: E}) {
      for (const [id, entity] of Object.entries(entityById)) {
          this.entityById.set(+id, entity);
      }
      const maxId = Math.max(...Object.keys(entityById).map(Number), this.idSequence);
      this.idSequence = maxId;
  }


  async getAll(): Promise<E[]> {
    return Array.from(this.entityById.values());
  }

  async getById(id: number): Promise<E> {
    const entity = this.entityById.get(id);
    if (!entity) {
      throw EntityNotExistsError;
    }
    return entity;
  }

  async save(entity: E): Promise<E> {
    const nextId = this.idSequence + 1;
    entity.id = nextId;
    this.entityById.set(nextId, entity);
    this.idSequence++;
    return entity;
  }

  async update(entity: E): Promise<E> {
    if (!this.entityById.has(entity.id)) {
      throw EntityNotExistsError;
    }
    this.entityById.set(entity.id, entity);
    return entity;
  }

  async delete(id: number): Promise<void> {
    this.entityById.delete(id);
  }
}