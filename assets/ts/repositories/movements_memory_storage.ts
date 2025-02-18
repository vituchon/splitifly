import { EntitiesRepository, Identifiable } from './common.js';
import { EntitiesMemoryStorage } from './entity_memory_storage.js';
import { Movement } from '../model/movement.js';

export interface MovementsRepository extends EntitiesRepository<Movement> {
  getByGroupId(groupId: number): Promise<Movement[]>;
}

export class MovementsMemoryRepository extends EntitiesMemoryStorage<Movement> implements MovementsRepository {
  async getByGroupId(groupId: number): Promise<Movement[]> {
    return Array.from(this.entitiesById.values())
      .filter(pm => pm.groupId === groupId);
  }
}