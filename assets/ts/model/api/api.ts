import { Group, Participant } from '../group';
import { Movement, ParticipantMovement, DebitCreditMap, ParticipantShareByParticipantId, ensureMovementAmountMatchesParticipantAmounts, buildParticipantsEqualShare, ensureSharesSumToZero, buildDebitCreditMap, sumDebitCreditMaps, sumParticipantShares } from '../movement';
import { Price } from '../price';
import { EntitiesRepository } from '../../repositories/common';
import { ParticipantsRepository, ParticipantsMemoryRepository } from '../../repositories/participants_memory_storage';
import { MovementsRepository, MovementsMemoryRepository } from '../../repositories/movements_memory_storage';
import { ParticipantMovementsRepository, ParticipantMovementsMemoryRepository } from '../../repositories/participant-movements-memory-storage';
import { EntitiesMemoryStorage } from '../../repositories/entity_memory_storage';

// Repository instances
const groupsRepository: EntitiesRepository<Group> = new EntitiesMemoryStorage<Group>();
const participantsRepository: ParticipantsRepository = new ParticipantsMemoryRepository();
const movementsRepository: MovementsRepository = new MovementsMemoryRepository();
const participantMovementsRepository: ParticipantMovementsRepository = new ParticipantMovementsMemoryRepository();

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

interface ParticipantInput {
    groupId: number;
    name: string;
}

export async function addParticipant(participant: ParticipantInput): Promise<Participant> {
    await groupsRepository.getById(participant.groupId); // Will throw if group doesn't exist

    const p: Participant = {
        id: 0,
        groupId: participant.groupId,
        name: participant.name
    };
    return participantsRepository.save(p);
}

export async function getParticipants(groupId: number): Promise<Participant[]> {
    return participantsRepository.getByGroupId(groupId);
}

interface ParticipantMovementInput {
    participantId: number;
    amount: Price;
}

interface MovementInput {
    groupId: number;
    amount: Price;
    concept: string;
    participantMovements: ParticipantMovementInput[];
}

export async function getMovements(groupId: number): Promise<Movement[]> {
    return movementsRepository.getByGroupId(groupId);
}

export async function getParticipantMovements(movementId: number): Promise<ParticipantMovement[]> {
    return participantMovementsRepository.getByMovementId(movementId);
}

export async function addMovement(movement: MovementInput): Promise<[Movement, ParticipantMovement[]]> {
    await groupsRepository.getById(movement.groupId);

    for (const participantMovement of movement.participantMovements) {
        const participant = await participantsRepository.getById(participantMovement.participantId);
        if (participant.groupId !== movement.groupId) {
            throw new Error(`Participant(id='${participant.id}') doesn't belong to movement's group(id='${movement.groupId}')`);
        }
    }

    const m: Movement = {
        id: 0,
        groupId: movement.groupId,
        amount: movement.amount,
        createdAt: Math.floor(Date.now() / 1000),
        concept: movement.concept
    };

    const savedMovement = await movementsRepository.save(m);

    const pms: ParticipantMovement[] = [];
    for (const participantMovement of movement.participantMovements) {
        const pm: ParticipantMovement = {
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
    const shares = buildParticipantsEqualShare(movement, participantMovements);
    ensureSharesSumToZero(shares);

    const balance = buildDebitCreditMap(participantMovements, shares);
    return [balance, shares];
}