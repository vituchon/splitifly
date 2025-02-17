import { EntitiesMemoryStorage } from './entity_memory_storage';
import { EntitiesRepository, Identifiable } from './common';
import { ParticipantMovement } from '../model/movement';


export interface ParticipantMovementsRepository extends EntitiesRepository<ParticipantMovement> {
  getByMovementId(movementId: number): Promise<ParticipantMovement[]>;
}

export class ParticipantMovementsMemoryRepository extends EntitiesMemoryStorage<ParticipantMovement> implements ParticipantMovementsRepository {
  async getByMovementId(movementId: number): Promise<ParticipantMovement[]> {
    return Array.from(this.entitiesById.values())
      .filter(participantMovement => participantMovement.movementId === movementId);
  }
}