import { Group, Participant as ModelParticipant} from '../group';
import { BaseMovement as ModelMovement, ParticipantMovement as ModelParticipantMovement, DebitCreditMap, ParticipantShareByParticipantId, ensureMovementAmountMatchesParticipantAmounts, buildParticipantsEqualShare, ensureSharesSumToZero, buildDebitCreditMap, sumDebitCreditMaps, sumParticipantShares, isTransferMovement, buildParticipantsTransferShare } from '../movement';
import { Price } from '../price';
import { EntitiesRepository, Collection } from '../../repositories/common';
import { ParticipantsRepository, ParticipantsMemoryRepository } from '../../repositories/participants_memory_storage';
import { MovementsRepository, MovementsMemoryRepository } from '../../repositories/movements_memory_storage';
import { ParticipantMovementsRepository, ParticipantMovementsMemoryRepository } from '../../repositories/participant-movements-memory-storage';
import { EntitiesMemoryStorage } from '../../repositories/entity_memory_storage';

// Repository instances
const groupsRepository: EntitiesRepository<Group> = new EntitiesMemoryStorage<Group>();
const participantsRepository: ParticipantsRepository = new ParticipantsMemoryRepository();
const movementsRepository: MovementsRepository = new MovementsMemoryRepository();
const participantMovementsRepository: ParticipantMovementsRepository = new ParticipantMovementsMemoryRepository();

// move this method to api.ts without appstate so repostores becomes hiding
export function initRepositories(groups: Collection<Group>, participants: Collection<ModelParticipant>, movements: Collection<ModelMovement>, participantMovements: Collection<ModelParticipantMovement>) {
  groupsRepository.init(groups)
  participantsRepository.init(participants)
  movementsRepository.init(movements)
  participantMovementsRepository.init(participantMovements)
}


// perhaps api could be an interface and NativeBrowserApi a class!
export async function createGroup(name: string): Promise<Group> {
    const group: Group = {
        id: 0,
        name: name
    };
    return groupsRepository.save(group);
}

export async function getAllGroups(): Promise<Group[]> {
    return groupsRepository.getAll();
}

export async function deleteGroup(groupId: number)  {
  const movements = await movementsRepository.getByGroupId(groupId)
  movements.forEach( async (movement) => {
    const pms = await participantMovementsRepository.getByMovementId(movement.id)
    pms.forEach(async (pm) => await participantMovementsRepository.delete(pm.id))
    await movementsRepository.delete(movement.id)
  })
  const participants = await participantsRepository.getByGroupId(groupId);
  participants.forEach(async (participant) => {
    await participantsRepository.delete(participant.id)
  })
  await groupsRepository.delete(groupId)
}

export interface Participant {
    groupId: number;
    name: string;
}

export async function addParticipant(participant: Participant): Promise<ModelParticipant> {
    await groupsRepository.getById(participant.groupId); // Will throw if group doesn't exist

    const p: ModelParticipant = {
        id: 0,
        groupId: participant.groupId,
        name: participant.name
    };
    return participantsRepository.save(p);
}

export class ParticipantDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipantDeletionError";
  }
}

export async function deleteParticipant(participantId: number): Promise<void> {
  const pms = await participantMovementsRepository.getByParticipantId(participantId)
  if (pms?.length > 0) {
    throw new ParticipantDeletionError("Can not delete participant that has movements");
  }
  return await participantsRepository.delete(participantId);
}

export async function getParticipants(groupId: number): Promise<ModelParticipant[]> {
    return participantsRepository.getByGroupId(groupId);
}

export async function getMovements(groupId: number): Promise<ModelMovement[]> {
    return movementsRepository.getByGroupId(groupId);
}

export async function deleteMovement(movementId: number): Promise<void> {
  const pms = await participantMovementsRepository.getByMovementId(movementId)
  pms.forEach(async (pm) => await participantMovementsRepository.delete(pm.id))
  await movementsRepository.delete(movementId)
}

export interface ParticipantMovement {
  participantId: number;
  amount: Price;
}

export interface Movement {
  groupId: number;
  amount: Price;
  concept: string;
  participantMovements: ParticipantMovement[];
}

export async function addMovement(movement: Movement): Promise<[ModelMovement, ModelParticipantMovement[]]> {
    await groupsRepository.getById(movement.groupId);

    for (const participantMovement of movement.participantMovements) {
        const participant = await participantsRepository.getById(participantMovement.participantId);
        if (participant.groupId !== movement.groupId) {
            throw new Error(`Participant(id='${participant.id}') doesn't belong to movement's group(id='${movement.groupId}')`);
        }
    }

    const m: ModelMovement = {
        id: 0,
        groupId: movement.groupId,
        amount: movement.amount,
        createdAt: Math.floor(Date.now() / 1000),
        concept: movement.concept
    };

    const savedMovement = await movementsRepository.save(m);

    const pms: ModelParticipantMovement[] = [];
    for (const participantMovement of movement.participantMovements) {
        const pm: ModelParticipantMovement = {
            id: 0,
            movementId: savedMovement.id,
            participantId: participantMovement.participantId,
            amount: participantMovement.amount
        };
        const savedPm = await participantMovementsRepository.save(pm);
        pms.push(savedPm);
    }

    return [savedMovement, pms];
}

export async function calculateAggregatedBalances(groupId: number): Promise<[DebitCreditMap, ParticipantShareByParticipantId]> {
    await groupsRepository.getById(groupId);

    const movements = await movementsRepository.getByGroupId(groupId);

    let accumulatedBalance = new Map<number, Map<number, Price>>();
    let accumulatedShare = new Map<number, Price>();

    for (const movement of movements) {
        const participantMovements = await participantMovementsRepository.getByMovementId(movement.id);

        ensureMovementAmountMatchesParticipantAmounts(movement, participantMovements);
        const participantShareByParticipantId = buildParticipantsEqualShare(movement, participantMovements);
        ensureSharesSumToZero(participantShareByParticipantId);

        accumulatedShare = sumParticipantShares(accumulatedShare, participantShareByParticipantId);

        const balance = buildDebitCreditMap(participantMovements, participantShareByParticipantId);
        accumulatedBalance = sumDebitCreditMaps(accumulatedBalance, balance);
    }

    return [accumulatedBalance, accumulatedShare];
}

export async function calculateBalance(groupId: number, movementId: number): Promise<[DebitCreditMap, ParticipantShareByParticipantId]> {
    await groupsRepository.getById(groupId);
    const movement = await movementsRepository.getById(movementId);
    const participantMovements = await participantMovementsRepository.getByMovementId(movement.id);

    ensureMovementAmountMatchesParticipantAmounts(movement, participantMovements);
    let shares: ParticipantShareByParticipantId;
    if (isTransferMovement(movement)) {
        shares = buildParticipantsTransferShare(movement);
    } else {
        shares = buildParticipantsEqualShare(movement, participantMovements);
    }
    ensureSharesSumToZero(shares);

    const balance = buildDebitCreditMap(participantMovements, shares);
    return [balance, shares];
}


export async function getParticipantMovements(movementId: number): Promise<ModelParticipantMovement[]> {
  return participantMovementsRepository.getByMovementId(movementId);
}
