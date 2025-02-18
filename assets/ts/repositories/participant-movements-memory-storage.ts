import { EntitiesMemoryStorage } from './entity_memory_storage.js';
import { EntitiesRepository, Identifiable } from './common.js';
import { ParticipantMovement } from '../model/movement.js';


export interface ParticipantMovementsRepository extends EntitiesRepository<ParticipantMovement> {
  getByMovementId(movementId: number): Promise<ParticipantMovement[]>;
}

export class ParticipantMovementsMemoryRepository extends EntitiesMemoryStorage<ParticipantMovement> implements ParticipantMovementsRepository {
  async getByMovementId(movementId: number): Promise<ParticipantMovement[]> {
    return Array.from(this.entitiesById.values())
      .filter(participantMovement => participantMovement.movementId === movementId);
  }
}