import * as api from '../model/api/api.js';
import { Group, Participant } from '../model/group.js';
import { DebitCreditMap, Movement, ParticipantMovement, ParticipantShareByParticipantId } from '../model/movement.js';

interface State {
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

console.log("init appState");

const STORAGE_KEY = "splitifly-app-state";

function loadState(): State {
  try {
    //debugger;
    const storedState = localStorage.getItem(STORAGE_KEY);
    const recoveredState = storedState ? JSON.parse(storedState) : getDefaultState();
    initializeRepositories(recoveredState)
    return recoveredState
  } catch (error) {
    console.error("Error loading state from localStorage:", error);
    return getDefaultState();
  }
}

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

export async function requestAggregatedBalances(groupId: number, appState: State) {
  try {
    const [balance, shares] = await api.calculateAggregatedBalances(groupId);
    return { balance, shares };
  } catch (error) {
    console.error('Error requesting aggregated balances:', error);
    throw error;
  }
}
