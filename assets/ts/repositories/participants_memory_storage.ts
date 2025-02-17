import { EntitiesRepository, Identifiable } from './common';
import { EntitiesMemoryStorage } from './entity_memory_storage';
import { Participant } from '../model/group';

export interface ParticipantsRepository extends EntitiesRepository<Participant> {
  getByGroupId(groupId: number): Promise<Participant[]>;
}

export class ParticipantsMemoryRepository extends EntitiesMemoryStorage<Participant> implements ParticipantsRepository {
  async getByGroupId(groupId: number): Promise<Participant[]> {
    return Array.from(this.entitiesById.values())
      .filter(participant => participant.groupId === groupId);
  }
}