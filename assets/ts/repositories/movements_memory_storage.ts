import { EntitiesRepository, Identifiable } from './common';
import { EntitiesMemoryStorage } from './entity_memory_storage';
import { Movement } from '../model/movement';

export interface MovementsRepository extends EntitiesRepository<Movement> {
  getByGroupId(groupId: number): Promise<Movement[]>;
}

export class MovementsMemoryRepository extends EntitiesMemoryStorage<Movement> implements MovementsRepository {
  async getByGroupId(groupId: number): Promise<Movement[]> {
    return Array.from(this.entityById.values())
      .filter(pm => pm.groupId === groupId);
  }
}