import { _Number } from '../util/number';
import { Movement, ParticipantMovement, ParticipantShareByParticipantId, DebitCreditMap, MovementType, isTransferMovement } from './movement';
import {
    buildParticipantsExpenseShare,
    buildParticipantsTransferShare,
    buildParticipantTransferMovements,
    ensureMovementAmountMatchesParticipantAmounts,
    ensureSharesSumToZero,
    buildDebitCreditMap,
    sumDebitCreditMaps,
    sumParticipantShares,
    deepCopyDebitCreditMap,
    cancelMutualDebts,
    eliminateIntermediaries
} from './movement';
import { newPrice } from './price';

describe('Movement Calculations', () => {
    describe('calculateDebitCreditMapForExpenseShare', () => {
        const tests: {
          name: string;
          movement: Movement;
          participantMovements: ParticipantMovement[];
          expected: Map<number, Map<number, _Number>>;
        }[] = [
            {
                name: "Movement fully covered by participant 1, resulting in participant 2 owing",
                movement: {
                    id: 1,
                    type: MovementType.expense,
                    amount: newPrice(1000),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                },
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(1000) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(0) }
                ],
                expected: new Map([[2, new Map([[1, newPrice(500)]])]])
            },
            {
                name: "Three participants with uneven distribution",
                movement: {
                    id: 1,
                    type: MovementType.expense,
                    amount: newPrice(900),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                },
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(900) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(0) },
                    { id: 3, participantId: 3, movementId: 1, amount: newPrice(0) }
                ],
                expected: new Map([
                    [2, new Map([[1, newPrice(300)]])],
                    [3, new Map([[1, newPrice(300)]])]
                ])
            },
            {
                name: "Two participants split payment",
                movement: {
                    id: 1,
                    type: MovementType.expense,
                    amount: newPrice(1000),
                    createdAt: 0,
                    concept: "Test",
                    groupId: 1
                },
                participantMovements: [
                    { id: 1, participantId: 1, movementId: 1, amount: newPrice(600) },
                    { id: 2, participantId: 2, movementId: 1, amount: newPrice(400) }
                ] ,
                expected: new Map([[2, new Map([[1, newPrice(100)]])]])
            }
        ];

        tests.forEach(test => {
            it(test.name, () => {
                ensureMovementAmountMatchesParticipantAmounts(test.movement, test.participantMovements);
                const participantShareByParticipantId = buildParticipantsExpenseShare(test.movement, test.participantMovements);
                ensureSharesSumToZero(participantShareByParticipantId);
                const generated = buildDebitCreditMap(test.participantMovements, participantShareByParticipantId);
                expect(areDebitCreditMapsEqual(generated, test.expected)).toBe(true);
            });
        });
    });

    describe('Transfer movements', () => {
        it('should create correct transfer share', () => {
            const movement: Movement = {
                id: 1,
                type: MovementType.transfer,
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
            const movement: Movement = {
                id: 1,
                type: MovementType.transfer,
                groupId: 1,
                createdAt: 0,
                amount: newPrice(1000),
                concept: "Transfer",
                fromParticipantId: 1,
                toParticipantId: 2
            };

            const participantMovements = buildParticipantTransferMovements(movement);
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
    const tests: {
        name: string;
        movement: Movement;
        shares: Map<number, _Number>;
        expected: Map<number, Map<number, _Number>>;
    }[] = [
        {
            name: "Participant 1 transfer to participant 2, participant 2 (receiver) owes participant 1 (emitter)",
            movement: {
                id: 1,
                type: MovementType.transfer,
                amount: newPrice(1000),
                createdAt: 0,
                concept: "Test",
                groupId: 1,
                fromParticipantId: 1,
                toParticipantId: 2
            },
            shares: new Map([
                [1, newPrice(1000)],
                [2, newPrice(-1000)]
            ]),
            expected: new Map([[2, new Map([[1, newPrice(1000)]])]])
        }
    ];

    tests.forEach(test => {
        it(test.name, () => {
          if (isTransferMovement(test.movement)) {
            const participantMovements = buildParticipantTransferMovements(test.movement);
            ensureMovementAmountMatchesParticipantAmounts(test.movement, participantMovements);
            const participantShareByParticipantId = buildParticipantsTransferShare(test.movement);
            ensureSharesSumToZero(participantShareByParticipantId);
            expect(areParticipantSharesEqual(participantShareByParticipantId, test.shares)).toBe(true);
            const generated = buildDebitCreditMap(participantMovements, participantShareByParticipantId);
            expect(areDebitCreditMapsEqual(generated, test.expected)).toBe(true);
          } else {
            console.error("must be a transfer movement!");
          }
        });
    });
});

describe('deepCopyDebitCreditMap', () => {
    it('should produce an equal copy', () => {
        const original: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(500)], [3, newPrice(300)]])],
            [2, new Map([[3, newPrice(200)]])]
        ]);
        const copy = deepCopyDebitCreditMap(original);
        expect(areDebitCreditMapsEqual(original, copy)).toBe(true);
    });

    it('should not be affected by modifications to the original outer map', () => {
        const original: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(500)]])]
        ]);
        const copy = deepCopyDebitCreditMap(original);
        original.set(3, new Map([[4, newPrice(100)]]));
        expect(copy.has(3)).toBe(false);
    });

    it('should not be affected by modifications to the original inner maps', () => {
        const original: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(500)]])]
        ]);
        const copy = deepCopyDebitCreditMap(original);
        original.get(1)!.set(3, newPrice(999));
        expect(copy.get(1)!.has(3)).toBe(false);
    });

    it('should handle an empty map', () => {
        const original: DebitCreditMap = new Map();
        const copy = deepCopyDebitCreditMap(original);
        expect(areDebitCreditMapsEqual(original, copy)).toBe(true);
    });
});

describe('cancelMutualDebts', () => {
    const tests: {
        name: string;
        participantIds: number[];
        input: DebitCreditMap;
        expected: DebitCreditMap;
    }[] = [
        {
            // A→B=500, B→A=200 → net: A→B=300
            name: "2 participantes: cancela deuda mutua dejando la diferencia",
            participantIds: [1, 2],
            input: new Map([
                [1, new Map([[2, newPrice(500)]])],
                [2, new Map([[1, newPrice(200)]])],
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(300)]])],
            ])
        },
        {
            // A→B=300, B→A=300 → nada
            name: "2 participantes: deudas iguales se cancelan completamente",
            participantIds: [1, 2],
            input: new Map([
                [1, new Map([[2, newPrice(300)]])],
                [2, new Map([[1, newPrice(300)]])],
            ]),
            expected: new Map()
        },
        {
            // A→B=500, sin reversa
            name: "2 participantes: deuda unidireccional queda igual",
            participantIds: [1, 2],
            input: new Map([
                [1, new Map([[2, newPrice(500)]])],
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(500)]])],
            ])
        },
        {
            name: "Mapa vacío: retorna mapa vacío",
            participantIds: [1, 2, 3],
            input: new Map(),
            expected: new Map()
        },
        {
            // A→B=100, B→A=400, A→C=200, C→A=50
            // net(A,B) = 100-400 = -300 → B→A=300
            // net(A,C) = 200-50 = 150 → A→C=150
            // net(B,C) = 0 → nada
            name: "3 participantes: deudas cruzadas se simplifican por par",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(100)], [3, newPrice(200)]])],
                [2, new Map([[1, newPrice(400)]])],
                [3, new Map([[1, newPrice(50)]])],
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(300)]])],
                [1, new Map([[3, newPrice(150)]])],
            ])
        },
        {
            // Todos le deben a todos: 1→2=5, 1→3=20, 2→1=15, 2→3=20, 3→1=16, 3→2=16
            // net(1,2) = 5-15 = -10 → 2→1=10
            // net(1,3) = 20-16 = 4 → 1→3=4
            // net(2,3) = 20-16 = 4 → 2→3=4
            name: "3 participantes: todos se deben mutuamente, se reduce a 3 deudas netas",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(5)], [3, newPrice(20)]])],
                [2, new Map([[1, newPrice(15)], [3, newPrice(20)]])],
                [3, new Map([[1, newPrice(16)], [2, newPrice(16)]])],
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(10)], [3, newPrice(4)]])],
                [1, new Map([[3, newPrice(4)]])],
            ])
        },
        {
            // 4 participantes: 1↔2 tienen deuda mutua, 3→4 unidireccional
            // net(1,2) = 100-60 = 40 → 1→2=40
            // net(3,4) = 0-200 = -200 → 4→3=200
            name: "4 participantes: solo un par tiene deuda mutua, el resto queda igual",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [2, new Map([[1, newPrice(60)]])],
                [4, new Map([[3, newPrice(200)]])],
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(40)]])],
                [4, new Map([[3, newPrice(200)]])],
            ])
        },
    ];

    tests.forEach(test => {
        it(test.name, () => {
            const result = cancelMutualDebts(test.input, test.participantIds);
            expect(areDebitCreditMapsEqual(result, test.expected)).toBe(true);
        });
    });
});

describe('eliminateIntermediaries', () => {
    const tests: {
        name: string;
        participantIds: number[];
        input: DebitCreditMap;
        expected: DebitCreditMap;
    }[] = [
        {
            // Caso original: cadena 1→3→2 (1 le debe 7 a 3 y 3 le debe 5 a 2)
            // Compensación: redirigir min(7,5)=5 de 1→3→2 a 1→2 directo
            // Resultado: 1→3 baja de 10 a 5, 1→2 sube de 5 a 10, 3→2 baja de 6 a 1
            name: "Cadena con ambas patas del mismo tamaño: compensa totalmente al intermediario",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(5)], [3, newPrice(10)]])],
                [2, new Map([[3, newPrice(1)]])],
                [3, new Map([[1, newPrice(3)], [2, newPrice(6)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(10)], [3, newPrice(5)]])],
                [2, new Map([[3, newPrice(1)]])],
                [3, new Map([[1, newPrice(3)], [2, newPrice(1)]])]
            ])
        },
        {
            // Input con deudas invertidas respecto al caso anterior
            // Net: 2→1:5, 2→3:5, 3→1:7. Cadena 2→3→1: min(5,7)=5
            // Resultado: 2→1 sube de 5 a 10, 2→3 baja de 6 a 1, 3→1 baja de 10 a 5
            name: "Cadena donde una pata es menor que la otra: compensa parcialmente (diff = min de ambas)",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[3, newPrice(3)]])],
                [2, new Map([[1, newPrice(5)], [3, newPrice(6)]])],
                [3, new Map([[1, newPrice(10)], [2, newPrice(1)]])]
            ]),
            expected: new Map([
                [1, new Map([[3, newPrice(3)]])],
                [2, new Map([[1, newPrice(10)], [3, newPrice(1)]])],
                [3, new Map([[1, newPrice(5)], [2, newPrice(1)]])]
            ])
        },
        {
            // Sin cadenas triangulares: todos le deben a 1, no hay intermediario
            name: "Sin cadenas triangulares: no modifica nada",
            participantIds: [1, 2, 3],
            input: new Map([
                [2, new Map([[1, newPrice(100)]])],
                [3, new Map([[1, newPrice(200)]])]
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(100)]])],
                [3, new Map([[1, newPrice(200)]])]
            ])
        },
        {
            // 4 participantes: cadena 1→2→3→4
            // Ahora lee nets desde map (actualizado), así la simplificación cascadea:
            //   Par (1,2): cadena 1→2→3: diff=min(3,10)=3 → 1→2=0, 1→3=3, 2→3=7
            //   Par (1,3): cadena 1→3→4: diff=min(3,7)=3 → 1→3=0, 1→4=3, 3→4=4
            //   Par (2,3): cadena 2→3→4: diff=min(7,4)=4 → 2→3=3, 2→4=4, 3→4=0
            name: "4 participantes: cadena larga 1→2→3→4 se simplifica eliminando intermediarios",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(3)]])],
                [2, new Map([[3, newPrice(10)]])],
                [3, new Map([[4, newPrice(7)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(0)], [3, newPrice(0)], [4, newPrice(3)]])],
                [2, new Map([[3, newPrice(3)], [4, newPrice(4)]])],
                [3, new Map([[4, newPrice(0)]])]
            ])
        },
        {
            // 4 participantes con deudas cruzadas:
            //   Par (1,2) else branch: cadena 2→1→3: diff=min(10,15)=10 → 2→1=0, 2→3=10, 1→3=5
            //   Par (2,4): cadena 2→4→3: diff=min(3,9)=3 → 2→4=0, 2→3=13, 4→3=6
            // Balance neto de cada participante se conserva
            name: "4 participantes: deudas cruzadas con dos cadenas independientes que se simplifican",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[3, newPrice(15)]])],
                [2, new Map([[1, newPrice(10)], [4, newPrice(3)]])],
                [3, new Map([[2, newPrice(7)]])],
                [4, new Map([[3, newPrice(9)]])]
            ]),
            expected: new Map([
                [1, new Map([[3, newPrice(5)]])],
                [2, new Map([[1, newPrice(0)], [3, newPrice(13)], [4, newPrice(0)]])],
                [3, new Map([[2, newPrice(7)]])],
                [4, new Map([[3, newPrice(6)]])]
            ])
        },
        {
            // Post cancelMutualDebts (scaled x10): 2→1=10, 1→3=4, 2→3=4
            // Cadena 2→1→3: diff=min(10, 4)=4
            //   2→1 baja de 10 a 6, 2→3 sube de 4 a 8, 1→3 baja de 4 a 0
            // Resultado: 2→1=6, 2→3=8, 1→3=0 (participante 1 eliminado como intermediario)
            name: "3 participantes: elimina intermediario 1 en cadena 2→1→3 (scaled x10)",
            participantIds: [1, 2, 3],
            input: new Map([
                [2, new Map([[1, newPrice(10)], [3, newPrice(4)]])],
                [1, new Map([[3, newPrice(4)]])]
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(6)], [3, newPrice(8)]])],
                [1, new Map([[3, newPrice(0)]])]
            ])
        },
        {
            // Mapa vacío
            name: "Mapa vacío: retorna mapa vacío",
            participantIds: [1, 2],
            input: new Map(),
            expected: new Map()
        }
    ];

    tests.forEach(test => {
        it(test.name, () => {
            const result = eliminateIntermediaries(test.input, test.participantIds);
            expect(areDebitCreditMapsEqual(result, test.expected)).toBe(true);
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
