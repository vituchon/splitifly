import * as api from '../model/api/api';
import { Group, Participant } from '../model/group';
import { DebitCreditMap, Movement, ParticipantMovement, ParticipantShareByParticipantId } from '../model/movement';
import { fromFractionJson, fromNumberJson } from '../model/price';

export interface State {
  groupById: {
    [groupId: number] : Group
  }
  participantById: {
    [participantId: number] : Participant
  }
  movementById: {
    [movementId: number]: Movement
  }
  participantMovementById: {
    [participantMovementId: number]: ParticipantMovement
  }
}

const STORAGE_KEY = "splitifly-local-storage";

function loadState(): State {
  try {
    //debugger;
    const storedState = localStorage.getItem(STORAGE_KEY);
    const recoveredState = storedState ? JSON.parse(storedState, jsonReviver) : getDefaultState();
    initializeRepositories(recoveredState)
    return recoveredState
  } catch (error) {
    console.error("Error loading state from localStorage:", error);
    return getDefaultState();
  }
}

const jsonReviver = (key: string, value: any) => {
  if (key === "amount") {
    if (typeof value === 'object') {
      return fromFractionJson(value)
    } else {
      return fromNumberJson(value) // to ensure backwards compatibility with older version that employs native js numbers
    }
  }
  return value;
};


function getDefaultState(): State {
  return {
    groupById: {},
    participantById: {},
    movementById: {},
    participantMovementById: {},
  };
}

// move this method to api.ts without appstate so repostores becomes hiding
function initializeRepositories(appState: State) {
  api.groupsRepository.load(appState.groupById)
  api.participantsRepository.load(appState.participantById)
  api.movementsRepository.load(appState.movementById)
  api.participantMovementsRepository.load(appState.participantMovementById)
}

export const state: State = loadState();

window.addEventListener("beforeunload", () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving state to localStorage:", error);
  }
});

// IDEA: composite pattern detected, the app.ts has some app specific affairs but below there a buffered repository class detected, time to kick with class!

export async function fetchGroups() {
  try {
    const groups = await api.getAllGroups();
    state.groupById = (groups || []).reduce((acc, group) => {
      acc[group.id] = group;
      return acc;
    }, state.groupById);
    return groups;
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw error;
  }
}

export async function createGroup(name: string) {
  try {
    const group = await api.createGroup(name);
    state.groupById[group.id]= group
    return group
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
}

export async function deleteGroup(groupId: number) {
  try {
    const groupMovements = Object.entries(state.movementById).filter(([id, movement]) => movement.groupId === groupId)
    for (const [movementId, movement] of groupMovements) {
      for (const [participantMovementId, participantMovement] of Object.entries(state.participantMovementById)) {
        if (participantMovement.movementId === movement.id) {
          delete state.participantMovementById[participantMovement.id]
          console.log("deleted participant's movement:", participantMovement)
        }
      }
      if (movement.groupId === groupId) {
        delete state.movementById[movement.id]
        console.log("deleted movement:", movement)
      }
    }
    const groupParticipants = Object.entries(state.participantById).filter(([id, participant]) => participant.groupId === groupId)
    for (const [participantId, participant] of groupParticipants) {
      delete state.participantById[participant.id]
      console.log("deleted participant:", participant)
    }
    const group = state.groupById[groupId]
    delete state.groupById[groupId]
    console.log("deleted group:", group)

    await api.deleteGroup(groupId);
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
}


export async function fetchParticipants(groupId: number) {
  try {
    const participants = await api.getParticipants(groupId);
    state.participantById = (participants || []).reduce((acc, participant) => {
      acc[participant.id] = participant;
      return acc;
    }, state.participantById);
    return participants;
  } catch (error) {
    console.error('Error fetching participants:', error);
    throw error;
  }
}

export async function addParticipant(name: string, groupId: number) {
  try {
    const participant = await api.addParticipant({ groupId, name });
    state.participantById[participant.id] = participant
    return participant
  } catch (error) {
    console.error('Error creating participant:', error);
    throw error;
  }
}

export async function deleteParticipant(participantId: number) {
  try {
    await api.deleteParticipant(participantId);
    delete state.participantById[participantId]
  } catch (error) {
    console.error('Error deleting participant:', error);
    throw error;
  }
}

export async function fetchMovements(groupId: number) {
  try {
    const movements = await api.getMovements(groupId);
    state.movementById = (movements || []).reduce((acc, movement ) => {
      acc[movement.id] = movement;
      return acc;
    }, state.movementById);
    return movements;
  } catch (error) {
    console.error('Error fetching movements:', error);
    throw error;
  }
}

export async function addMovement(movement: api.Movement) {
  try {
    const [m, pms] = await api.addMovement(movement);
    state.movementById[m.id] = m
    state.participantMovementById = (pms || []).reduce((acc, pm) => {
      acc[pm.id] = pm
      return acc;
    }, state.participantMovementById);
    return m
  } catch (error) {
    console.error('Error adding movement:', error);
    throw error;
  }
}


export async function deleteMovement(movementId: number) {
  try {
    await api.deleteMovement(movementId);
    delete state.movementById[movementId]
    for (const _movementId in state.participantMovementById) {
      if (state.participantMovementById[_movementId].movementId === movementId) {
        delete state.participantMovementById[_movementId];
      }
    }
  } catch (error) {
    console.error('Error deleting movement:', error);
    throw error;
  }
}

export async function fetchParticipantMovements(movementId: number) {
  try {
    const pms = await api.getParticipantMovements(movementId);
    state.participantMovementById = (pms || []).reduce((acc, pm) => {
      acc[pm.id] = pm
      return acc;
    }, state.participantMovementById);
    return pms
  } catch (error) {
    console.error('Error fetching participant movements:', error);
    throw error;
  }
}

export async function requestAggregatedBalances(groupId: number) {
  try {
    const [balance, shares] = await api.calculateAggregatedBalances(groupId);
    return { balance, shares };
  } catch (error) {
    console.error('Error requesting aggregated balances:', error);
    throw error;
  }
}


/**
 *  caso para probar...
 *
 * Balance entre participantes
Participante	1	2	3
1	X	0	3
2	0	X	0
3	3	3	X
Balance total
Participante	Balance
1	0
2	3
3	-3

 * {"groupById":{"1":{"id":1,"name":"a","participants":[{"id":2,"groupId":1,"name":"1"},{"id":3,"groupId":1,"name":"2"},{"id":4,"groupId":1,"name":"3"}],"movements":[{"id":1,"groupId":1,"amount":2,"createdAt":1739993805,"concept":"almuerzo"}]}},"participantById":{"2":{"id":2,"groupId":1,"name":"1"},"3":{"id":3,"groupId":1,"name":"2"},"4":{"id":4,"groupId":1,"name":"3"}},"movementById":{"1":{"id":1,"groupId":1,"amount":2,"createdAt":1739993805,"concept":"almuerzo"}},"participantMovementById":{"1":{"id":1,"movementId":1,"participantId":2,"amount":1},"2":{"id":2,"movementId":1,"participantId":3,"amount":1},"3":{"id":3,"movementId":1,"participantId":4,"amount":0}}}
 */