import { newPrice, Price, zeroValue } from './price';

export enum MovementType {
  expense = "expense" ,
  transfer = "transfer"
}

// si necesito valores
// const movementOptions = Object.values(MovementType); // ["expense", "transfer"]

export interface BaseMovement {
  id: number;
  type: MovementType;
  groupId: number;
  createdAt: number;
  amount: Price;
  concept: string;
}

export interface ExpenseMovement extends BaseMovement {
  type: MovementType.expense;
}

export interface TransferMovement extends BaseMovement {
  type:  MovementType.transfer;
  fromParticipantId: number;
  toParticipantId: number;
}

export type Movement = ExpenseMovement | TransferMovement;

export function isTransferMovement(movement: Movement): movement is TransferMovement {
  return movement.type === MovementType.transfer
}

export interface ParticipantMovement {
  id: number;
  movementId: number;
  participantId: number;
  amount: Price;
}

export type ParticipantShareByParticipantId = Map<number, Price>;
export type DebitCreditMap = Map<number, Map<number, Price>>;

export interface BalanceSheet {
  getCredit(participantId: number): number;
  getDebt(participantId: number): number;
}

export function buildParticipantsExpenseShare(movement: Movement, participantMovements: ParticipantMovement[]): ParticipantShareByParticipantId {
  const equalShare = movement.amount.divide(newPrice(participantMovements.length))
  const participantShareByParticipantId = new Map<number, Price>();

  for (const participantMovement of participantMovements) {
      const participantShare = participantMovement.amount.subtract(equalShare)
      participantShareByParticipantId.set(participantMovement.participantId, participantShare);
  }
  return participantShareByParticipantId;
}

export function buildParticipantsTransferShare(movement: TransferMovement): ParticipantShareByParticipantId {
  const participantShareByParticipantId = new Map<number, Price>();
  participantShareByParticipantId.set(movement.fromParticipantId, movement.amount); // creditor
  participantShareByParticipantId.set(movement.toParticipantId, movement.amount.negate()); // debtor
  return participantShareByParticipantId;
}

export function buildParticipantTransferMovements(movement: TransferMovement): ParticipantMovement[] {
  return [
      { id: 0, participantId: movement.fromParticipantId, movementId: movement.id, amount: movement.amount }, // gives full amount
      { id: 0, participantId: movement.toParticipantId, movementId: movement.id, amount: newPrice(0) }, // gives nothing
  ];
}

export class MovementError extends Error {
  constructor(message: string) {
      super(message);
      this.name = 'MovementError';
  }
}

export function ensureMovementAmountMatchesParticipantAmounts(movement: Movement, participantMovements: ParticipantMovement[]): void {
  const totalAmount = participantMovements.reduce((sum, pm) => sum.add(pm.amount), newPrice(0));
  if (!movement.amount.equals(totalAmount)) {
      throw new MovementError('The movement amount must match the sum of all participants\' amounts.');
  }
}

export function ensureSharesSumToZero(participantShareByParticipantId: ParticipantShareByParticipantId): void {
  const totalAmount = Array.from(participantShareByParticipantId.values()).reduce((sum, share) => sum.add(share),  newPrice(0));
  if (!totalAmount.equals(zeroValue())) {
      throw new MovementError('The sum of shares must equal zero');
  }
}

export function deepCopyParticipantShareByParticipantId(original: Map<number, Price>): Map<number, Price> {
  return new Map(original);
}

export function buildDebitCreditMap(participantMovements: ParticipantMovement[], shares: ParticipantShareByParticipantId): DebitCreditMap {
  const debitCreditMap = new Map<number, Map<number, Price>>();
  const sharesCopy = deepCopyParticipantShareByParticipantId(shares);
  const participantIds = Array.from(sharesCopy.keys()).sort((a, b) => a - b);

  for (const participantMovement of participantMovements) {
      const participantShare = sharesCopy.get(participantMovement.participantId) || newPrice(0);
      const participantHasDebt = participantShare.isLowerStrict(zeroValue())

      if (participantHasDebt) {
          debitCreditMap.set(participantMovement.participantId, new Map<number, Price>());

          for (const id of participantIds) {
              const share = sharesCopy.get(id) || newPrice(0);
              if (id === participantMovement.participantId) continue;

              const participantHasCredit = share.isHigherStrict(zeroValue())
              if (participantHasCredit) {
                  const remainingShare = share.add(participantShare)
                  const currentDebitMap = debitCreditMap.get(participantMovement.participantId)!;

                  if (remainingShare.isHigherOrEquals(zeroValue())) {
                      currentDebitMap.set(id, participantShare.negate());
                      sharesCopy.set(participantMovement.participantId, newPrice(0));
                      sharesCopy.set(id, remainingShare);
                      break;
                  } else {
                      currentDebitMap.set(id, share);
                      sharesCopy.set(participantMovement.participantId, remainingShare);
                      sharesCopy.set(id, newPrice(0));
                  }
              }
          }
      }
  }
  return debitCreditMap;
}

export function sumDebitCreditMaps(left: DebitCreditMap, right: DebitCreditMap): DebitCreditMap {
  const result = new Map<number, Map<number, Price>>();

  function addDebitCreditMap(source: DebitCreditMap, target: DebitCreditMap) {
      for (const [i, innerMap] of source.entries()) {
          if (!target.has(i)) {
              target.set(i, new Map<number, Price>());
          }
          const targetInnerMap = target.get(i)!;

          for (const [j, value] of innerMap.entries()) {
              targetInnerMap.set(j, (targetInnerMap.get(j) || newPrice(0)).add(value));
          }
      }
  }

  addDebitCreditMap(left, result);
  addDebitCreditMap(right, result);

  return result;
}

export function sumParticipantShares(left: ParticipantShareByParticipantId, right: ParticipantShareByParticipantId): ParticipantShareByParticipantId {
  const result = new Map<number, Price>();

  function addParticipantShare(source: ParticipantShareByParticipantId, target: ParticipantShareByParticipantId) {
      for (const [id, value] of source.entries()) {
        target.set(id, (target.get(id) || newPrice(0)).add(value))
      }
  }

  addParticipantShare(left, result);
  addParticipantShare(right, result);

  return result;
}
