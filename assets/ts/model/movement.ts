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

export function deepCopyDebitCreditMap(original: DebitCreditMap): DebitCreditMap {
  const copy = new Map<number, Map<number, Price>>();
  for (const [key, innerMap] of original.entries()) {
    copy.set(key, new Map(innerMap));
  }
  return copy;
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

export function cancelMutualDebts(debitCreditMap: DebitCreditMap, participantIds: number[]): DebitCreditMap {
  const map = new Map<number, Map<number, Price>>();

  for (const i of participantIds) {
    for (const j of participantIds) {
      if (i >= j) {
        continue;
      }
      const iOwesJ = debitCreditMap.get(i)?.get(j) || newPrice(0);
      const jOwesI = debitCreditMap.get(j)?.get(i) || newPrice(0);
      const net = iOwesJ.subtract(jOwesI); // if iOwesJ is higher than jOwesI, net will be positive, meaning i owes j. If jOwesI is higher than iOwesJ, net will be negative, meaning j owes i.

      if (net.isHigherStrict(zeroValue())) { // i owes j
        if (!map.has(i)) {
          map.set(i, new Map<number, Price>());
        }
        map.get(i)!.set(j, net);
      } else if (net.isLowerStrict(zeroValue())) { // j owes i
        if (!map.has(j)) {
          map.set(j, new Map<number, Price>());
        }
        map.get(j)!.set(i, net.negate());
      }
    }
  }

  return map;
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


export function eliminateIntermediaries(debitCreditMap: DebitCreditMap, participantIds: number[]): DebitCreditMap {
  const map = deepCopyDebitCreditMap(debitCreditMap);

  for (const i of participantIds) {
    for (const j of participantIds) {
      if (i >= j) {
        continue;
      }
      const iOwesJ = map.get(i)?.get(j) || newPrice(0);
      const jOwesI = map.get(j)?.get(i) || newPrice(0);
      const net_i_j = iOwesJ.subtract(jOwesI); // if iOwesJ is higher than jOwesI, net will be positive, meaning i owes j. If jOwesI is higher than iOwesJ, net will be negative, meaning j owes i.

      if (net_i_j.isHigherStrict(zeroValue())) { // i owes j
        for (const k of participantIds) {
          if (k == i || k == j) {
            continue;
          }
          const jOwesK = map.get(j)?.get(k) || newPrice(0);
          const kOwesJ = map.get(k)?.get(j) || newPrice(0);
          const net_k_j = kOwesJ.subtract(jOwesK);
          if (net_k_j.isLowerStrict(zeroValue())) { // j owes k ( so i -> j -> k)
              const iDebs = map.get(i)!
              // diff = min(net_i_j, |net_k_j|): la compensación no puede exceder ninguna de las dos patas de la cadena i→j→k
              // Si i le debe 5 a j y j le debe 7 a k, solo podemos redirigir 5 (el mínimo), no 7
              const absNetKJ = net_k_j.abs();
              const diff = net_i_j.isLowerOrEquals(absNetKJ) ? net_i_j : absNetKJ;
              iDebs.set(j, iDebs.get(j).subtract(diff)) // i le debe menos a j (porque ahora le paga directo a k)
              iDebs.set(k, (iDebs.get(k) || newPrice(0)).add(diff)) // i le debe más a k (pago directo en vez de pasar por j)

              const jDebts = map.get(j)!
              jDebts.set(k, jDebts.get(k).subtract(diff));
          }
        }
      } else if (net_i_j.isLowerStrict(zeroValue())) { // j owes i
        for (const k of participantIds) {
          if (k == i || k == j) {
            continue;
          }
          const iOwesK = map.get(i)?.get(k) || newPrice(0);
          const kOwesI = map.get(k)?.get(i) || newPrice(0);
          const net_k_i = kOwesI.subtract(iOwesK);
          if (net_k_i.isLowerStrict(zeroValue())) { // i owes k ( so j -> i -> k)
              const jDebs = map.get(j)!
              // diff = min(|net_i_j|, |net_k_i|): simétrico al branch de arriba, ahora la cadena es j→i→k
              // net_i_j es negativo acá (j le debe a i), lo negamos para obtener el valor positivo
              const absNetIJ = net_i_j.negate();
              const absNetKI = net_k_i.abs();
              const diff = absNetIJ.isLowerOrEquals(absNetKI) ? absNetIJ : absNetKI;
              jDebs.set(i, jDebs.get(i).subtract(diff)) // j le debe menos a i (porque ahora le paga directo a k)
              jDebs.set(k, (jDebs.get(k) || newPrice(0)).add(diff)) // j le debe más a k (pago directo)

              const iDebts = map.get(i)!
              iDebts.set(k, iDebts.get(k).subtract(diff)); // i le debe menos a k (j le paga directo)
          }
        }
      }
    }
  }

  return map;
}

export function debitCreditMapToString(debitCreditMap: DebitCreditMap, participantIds: number[]): string {
  const ids = [...participantIds].sort((a, b) => a - b);
  const colWidth = 8;
  const pad = (s: string) => s.padStart(colWidth);

  let header = pad('') + ids.map(id => pad(String(id))).join('');
  let rows = ids.map(i => {
    let row = pad(String(i));
    for (const j of ids) {
      const val = debitCreditMap.get(i)?.get(j) || newPrice(0);
      row += pad(val.toNumber().toString());
    }
    return row;
  });

  return [header, ...rows].join('\n');
}