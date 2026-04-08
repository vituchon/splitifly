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
  public details?: string;
  constructor(message: string, details?: string) {
      super(message);
      this.name = 'MovementError';
      this.details = details;
  }
}

export function ensureMovementAmountIsNotZero(movement: BaseMovement): void {
  if (movement.amount.equals(zeroValue())) {
    throw new MovementError('error.movement.amount_zero');
  }
}

export function ensureMovementAmountMatchesParticipantAmounts(movement: Movement, participantMovements: ParticipantMovement[]): void {
  const totalAmount = participantMovements.reduce((sum, pm) => sum.add(pm.amount), newPrice(0));
  if (!movement.amount.equals(totalAmount)) {
      throw new MovementError('error.movement.amount_mismatch');
  }
}

export function ensureSharesSumToZero(participantShareByParticipantId: ParticipantShareByParticipantId): void {
  const totalAmount = Array.from(participantShareByParticipantId.values()).reduce((sum, share) => sum.add(share),  newPrice(0));
  if (!totalAmount.equals(zeroValue())) {
      throw new MovementError('error.movement.shares_not_zero');
  }
}

// Shallow copy: creates a new Map and copies entries by reference.
// ⚠️ Keys are numbers (primitives), but values are Price objects (_Number interface).
// This works safely ONLY because Price instances are treated as immutable (methods like add/subtract return new instances instead of mutating).
// TODO: if Price ever becomes mutable, this must be changed to a deep copy!
export function shallowCopyParticipantShareByParticipantId(original: Map<number, Price>): Map<number, Price> {
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
  const sharesCopy = shallowCopyParticipantShareByParticipantId(shares);
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

// 📚 Debt simplification via "bilateral netting" (compensación bilateral).
// Para cada par (i,j), netea las deudas mutuas: si i→j=500 y j→i=200, queda i→j=300.
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


// 📚 Debt simplification via "multilateral netting" (compensación multilateral).
// Redirige pagos que pasan por intermediarios: si i→j→k, redirige a i→k directo.
//
// 📐 Complejidad teórica: el problema de minimizar la cantidad absoluta de transferencias
// es NP-hard (equivalente a zero-sum set packing). Sin embargo, una solución con a lo sumo
// (N-1) transferencias (N = cantidad de participantes) se puede lograr en tiempo lineal
// combinando bilateral netting (cancelMutualDebts) + multilateral netting (esta función).
//
// Corre múltiples pasadas de eliminación + cancelación bilateral hasta convergencia
// (o hasta N iteraciones como cota máxima). Cada pasada puede generar nuevas cadenas
// o deudas mutuas que la siguiente pasada resuelve.
//
// ⚠️ No garantiza el mínimo absoluto de transferencias (eso sería NP-hard),
// pero en la práctica produce resultados muy buenos para grupos pequeños.
export function simplifyBalance(debitCreditMap: DebitCreditMap, participantIds: number[]): DebitCreditMap {
  let map = deepCopyDebitCreditMap(debitCreditMap);
  const maxPasses = participantIds.length;

  for (let pass = 0; pass < maxPasses; pass++) {
    const before = countNonZeroDebts(map);
    map = eliminateIntermediaries(map, participantIds);
    map = cancelMutualDebts(map, participantIds);
    const after = countNonZeroDebts(map);
    if (after >= before) {
      break; // convergió: no hubo mejora
    }
  }

  return map;
}

function countNonZeroDebts(map: DebitCreditMap): number {
  let count = 0;
  for (const [, innerMap] of map) {
    for (const [, amount] of innerMap) {
      if (amount.isHigherStrict(zeroValue())) {
        count++;
      }
    }
  }
  return count;
}

export function eliminateIntermediaries(map: DebitCreditMap, participantIds: number[]): DebitCreditMap {
  const result = deepCopyDebitCreditMap(map);
  for (const a of participantIds) {
    for (const b of participantIds) {
      if (a >= b) {
        continue;
      }
      const aOwesB = result.get(a)?.get(b) || newPrice(0);
      const bOwesA = result.get(b)?.get(a) || newPrice(0);
      const netAB = aOwesB.subtract(bOwesA);

      if (netAB.equals(zeroValue())) {
        continue;
      }

      // Determinar origin y via (intermedario) según el signo de la deuda neta
      // netAB > 0: a le debe a b → origin=a, via=b
      // netAB < 0: b le debe a a → origin=b, via=a
      const [origin, via] = netAB.isHigherStrict(zeroValue()) ? [a, b] : [b, a];
      const absNet = netAB.abs();

      for (const dest of participantIds) {
        if (dest == a || dest == b) {
          continue;
        }
        const viaOwesDest = result.get(via)?.get(dest) || newPrice(0);
        const destOwesVia = result.get(dest)?.get(via) || newPrice(0);
        const netViaDest = destOwesVia.subtract(viaOwesDest);
        if (netViaDest.isLowerStrict(zeroValue())) { // via le debe a dest → cadena: origin → via → dest
            const absNetViaDest = netViaDest.abs();
            // diff = min(absNet, absNetViaDest): la compensación no puede exceder ninguna de las dos patas de la cadena
            const diff = absNet.isLowerOrEquals(absNetViaDest) ? absNet : absNetViaDest;
            const originDebts = result.get(origin)!;
            originDebts.set(via, originDebts.get(via).subtract(diff)); // origin le debe menos a via (ahora le paga directo a dest)
            originDebts.set(dest, (originDebts.get(dest) || newPrice(0)).add(diff)); // origin le debe más a dest (pago directo)

            const viaDebts = result.get(via)!;
            viaDebts.set(dest, viaDebts.get(dest).subtract(diff)); // via le debe menos a dest (origin le paga directo)
        }
      }
    }
  }
  return result;
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