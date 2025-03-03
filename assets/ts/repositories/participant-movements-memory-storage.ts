import { EntitiesMemoryStorage } from './entity_memory_storage';
import { EntitiesRepository, Identifiable } from './common';
import { ParticipantMovement } from '../model/movement';


export interface ParticipantMovementsRepository extends EntitiesRepository<ParticipantMovement> {
  getByParticipantId(participantId: number): Promise<ParticipantMovement[]>;
  getByMovementId(movementId: number): Promise<ParticipantMovement[]>;
}

export class ParticipantMovementsMemoryRepository extends EntitiesMemoryStorage<ParticipantMovement> implements ParticipantMovementsRepository {
  async getByParticipantId(participantId: number) {
    return Array.from(this.entityById.values())
      .filter(participantMovement => participantMovement.participantId === participantId);
  }
  async getByMovementId(movementId: number): Promise<ParticipantMovement[]> {
    return Array.from(this.entityById.values())
      .filter(participantMovement => participantMovement.movementId === movementId);
  }
}