import { _Number } from '../util/number';
import { Movement, TransferMovement, ParticipantMovement, ParticipantShareByParticipantId, DebitCreditMap } from './movement';
import {
    buildParticipantsEqualShare,
    buildParticipantsTransferShare,
    buildParticipantsTransferMovements,
    ensureMovementAmountMatchesParticipantAmounts,
    ensureSharesSumToZero,
    buildDebitCreditMap,
    sumDebitCreditMaps,
    sumParticipantShares
} from './movement';
import { newPrice } from './price';

describe('Movement Calculations', () => {
    describe('calculateDebitCreditMapForEqualShare', () => {
        const tests = [
            {
                name: "Movement fully covered by participant 1, resulting in participant 2 owing",
                movement: {
                    id: 1,
                    amount: newPrice(1000),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                } as Movement,
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(1000) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(0) }
                ] as ParticipantMovement[],
                expected: new Map([[2, new Map([[1, newPrice(500)]])]])
            },
            {
                name: "Three participants with uneven distribution",
                movement: {
                    id: 1,
                    amount: newPrice(900),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                } as Movement,
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(900) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(0) },
                    { id: 3, participantId: 3, movementId: 1, amount: newPrice(0) }
                ] as ParticipantMovement[],
                expected: new Map([
                    [2, new Map([[1, newPrice(300)]])],
                    [3, new Map([[1, newPrice(300)]])]
                ])
            },
            {
                name: "Two participants split payment",
                movement: {
                    id: 1,
                    amount: newPrice(1000),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                } as Movement,
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(600) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(400) }
                ] as ParticipantMovement[],
                expected: new Map([[2, new Map([[1, newPrice(100)]])]])
            }
        ];

        tests.forEach(test => {
            it(test.name, () => {
                ensureMovementAmountMatchesParticipantAmounts(test.movement, test.participantMovements);
                const participantShareByParticipantId = buildParticipantsEqualShare(test.movement, test.participantMovements);
                ensureSharesSumToZero(participantShareByParticipantId);
                const generated = buildDebitCreditMap(test.participantMovements, participantShareByParticipantId);
                expect(areDebitCreditMapsEqual(generated, test.expected)).toBe(true);
            });
        });
    });

    describe('Transfer movements', () => {
        it('should create correct transfer share', () => {
            const movement: TransferMovement = {
                id: 1,
                groupId: 1,
                createdAt: 0,
                amount: newPrice(1000),
                concept: "Transfer",
                fromParticipantId: 1,
                toParticipantId: 2
            };

            const shares = buildParticipantsTransferShare(movement);
            expect(shares.get(1)).toBe(newPrice(1000));  // creditor
            expect(shares.get(2)).toBe(newPrice(-1000)); // debtor
            ensureSharesSumToZero(shares);
        });

        it('should create correct transfer participant movements', () => {
            const movement: TransferMovement = {
                id: 1,
                groupId: 1,
                createdAt: 0,
                amount: newPrice(1000),
                concept: "Transfer",
                fromParticipantId: 1,
                toParticipantId: 2
            };

            const participantMovements = buildParticipantsTransferMovements(movement);
            expect(newPrice(participantMovements.length)).toBe(newPrice(2));
            expect(participantMovements[0].amount).toBe(newPrice(1000));
            expect(participantMovements[1].amount).toBe(newPrice(0));
            expect(participantMovements[0].participantId).toBe(1);
            expect(participantMovements[1].participantId).toBe(2);
        });
    });

    describe('Sum operations', () => {
        it('should sum debit credit maps correctly', () => {
            const map1 = new Map([[1, new Map([[2, newPrice(500)]])]]);
            const map2 = new Map([[1, new Map([[2, newPrice(300)]])]]);

            const result = sumDebitCreditMaps(map1, map2);
            expect(result.get(1)?.get(2)).toBe(newPrice(800));
        });

        it('should sum participant shares correctly', () => {
            const shares1 = new Map([[1, newPrice(500)], [2, newPrice(-500)]]);
            const shares2 = new Map([[1, newPrice(300)], [2, newPrice(-300)]]);

            const result = sumParticipantShares(shares1, shares2);
            expect(result.get(1)).toBe(newPrice(800));
            expect(result.get(2)).toBe(newPrice(-800));
        });
    });
});


describe('CalculateDebitCreditMapForTransfer', () => {
    const tests = [
        {
            name: "Participant 1 transfer to participant 2, participant 2 (receiver) owes participant 1 (emitter)",
            transferMovement: {
                id: 1,
                amount: newPrice(1000),
                createdAt: 0,
                concept: "Test",
                groupId: 1,
                fromParticipantId: 1,
                toParticipantId: 2
            } as TransferMovement,
            shares: new Map([
                [1, newPrice(1000)],
                [2, newPrice(-1000)]
            ]),
            expected: new Map([[2, new Map([[1, newPrice(1000)]])]])
        }
    ];

    tests.forEach(test => {
        it(test.name, () => {
            const participantMovements = buildParticipantsTransferMovements(test.transferMovement);
            ensureMovementAmountMatchesParticipantAmounts(test.transferMovement, participantMovements);
            const participantShareByParticipantId = buildParticipantsTransferShare(test.transferMovement);
            ensureSharesSumToZero(participantShareByParticipantId);
            expect(areParticipantSharesEqual(participantShareByParticipantId, test.shares)).toBe(true);
            const generated = buildDebitCreditMap(participantMovements, participantShareByParticipantId);
            expect(areDebitCreditMapsEqual(generated, test.expected)).toBe(true);
        });
    });
});

// Función auxiliar para comparar DebitCreditMaps
function areDebitCreditMapsEqual(left: DebitCreditMap, right: DebitCreditMap): boolean {
    if (left.size !== right.size) {
        console.log(`Length mismatch: left=${left.size}, right=${right.size}`);
        return false;
    }

    for (const [key, leftInnerMap] of left) {
        const rightInnerMap = right.get(key);
        if (!rightInnerMap) {
            console.log(`Key ${key} found in left but not in right`);
            return false;
        }

        if (leftInnerMap.size !== rightInnerMap.size) {
            console.log(`Inner map length mismatch for key ${key}: left=${leftInnerMap.size}, right=${rightInnerMap.size}`);
            return false;
        }

        for (const [innerKey, leftValue] of leftInnerMap) {
            const rightValue = rightInnerMap.get(innerKey);
            if (rightValue === undefined) {
                console.log(`Inner key ${innerKey} for outer key ${key} found in left but not in right`);
                return false;
            }
            if (!leftValue.equals(rightValue)) {
                console.log(`Value mismatch at key ${key} -> ${innerKey}: left=${leftValue}, right=${rightValue}`);
                return false;
            }
        }
    }

    return true;
}

// Función auxiliar para comparar ParticipantShares
function areParticipantSharesEqual(left: ParticipantShareByParticipantId, right: ParticipantShareByParticipantId): boolean {
    if (left.size !== right.size) {
      return false;
    }

    for (const [key, value] of left) {
        if (!right.get(key).equals(value)) {
          return false;
        }
    }

    return true;
}

// Framework de testing minimalista
function describe(description: string, fn: () => void) {
    console.log(description);
    fn();
}

function it(description: string, fn: () => void) {
    try {
        fn();
        console.log(`✓ ${description}`);
    } catch (error) {
        console.error(`✗ ${description}`);
        console.error(error);
    }
}

// following advice from chatgpt (https://stackoverflow.com/a/13212871/903998)
function expect(actual: boolean): { toBe(expected: boolean): void };
function expect(actual: number): { toBe(expected: number): void };
function expect(actual: _Number): { toBe(expected: _Number): void };

function expect(actual: boolean | number | _Number) {
    return {
        toBe: (expected: boolean | number | _Number) => {
            if (typeof actual === 'boolean' && typeof expected === 'boolean') {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected} but got ${actual}`);
                }
            } else if (typeof actual === 'number' && typeof expected === 'number') {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected} but got ${actual}`);
                }
            } else if (isNumber(actual) && isNumber(expected)) {
                if (!actual.equals(expected)) {
                    throw new Error(`Expected ${expected.toNumber()} but got ${actual.toNumber()}`);
                }
            } else {
                throw new Error('Incompatible types for comparison');
            }
        }
    };
}

function isNumber(obj: any): obj is _Number {
  return obj && typeof obj.equals === 'function';
}
