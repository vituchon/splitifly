import { Price } from './price';
import { Movement, ParticipantMovement, ParticipantShareByParticipantId, DebitCreditMap, MovementType, MovementError, isTransferMovement } from './movement';
import {
    buildParticipantsExpenseShare,
    buildParticipantsTransferShare,
    buildParticipantTransferMovements,
    ensureMovementAmountMatchesParticipantAmounts,
    ensureMovementAmountIsNotZero,
    ensureSharesSumToZero,
    buildDebitCreditMap,
    sumDebitCreditMaps,
    sumParticipantShares,
    deepCopyDebitCreditMap,
    cancelMutualDebts,
    simplifyBalance,
    eliminateIntermediaries
} from './movement';
import { newPrice, zeroValue } from './price';

describe('Movement Calculations', () => {
    describe('calculateDebitCreditMapForExpenseShare', () => {
        const tests: {
          name: string;
          movement: Movement;
          participantMovements: ParticipantMovement[];
          expected: Map<number, Map<number, Price>>;
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
        shares: Map<number, Price>;
        expected: Map<number, Map<number, Price>>;
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
            // Cadena A→B→C: diff=min(100,100)=100, redirige a A→C
            name: "Cadena simple A→B→C se redirige a A→C",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [2, new Map([[3, newPrice(100)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, zeroValue()], [3, newPrice(100)]])],
                [2, new Map([[3, zeroValue()]])]
            ])
        },
        {
            // Cadena A→B→C: diff=min(100,60)=60, parcial
            name: "Cadena parcial: compensación limitada por la pata menor",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [2, new Map([[3, newPrice(60)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(40)], [3, newPrice(60)]])],
                [2, new Map([[3, newPrice(0)]])]
            ])
        },
        {
            // Sin cadenas: deudas independientes quedan igual
            name: "Sin cadenas: deudas independientes quedan igual",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [3, new Map([[4, newPrice(200)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [3, new Map([[4, newPrice(200)]])]
            ])
        },
        {
            name: "Mapa vacío",
            participantIds: [],
            input: new Map(),
            expected: new Map()
        },
        {
            // Solo 2 participantes, no hay tercer nodo para intermediario
            name: "2 participantes sin intermediario posible",
            participantIds: [1, 2],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(100)]])]
            ])
        },
        {
            // Cascada 1→2→3→4: cada uno 100.
            // Par (1,2): cadena 1→2→3, diff=min(100,100)=100 → 1→2:0, 1→3:100, 2→3:0
            // Par (1,3): cadena 1→3→4, diff=min(100,100)=100 → 1→3:0, 1→4:100, 3→4:0
            // Resultado: 1→2:0, 1→3:0, 1→4:100, 2→3:0, 3→4:0
            name: "Cascada de 4 participantes 1→2→3→4 se colapsa en una sola deuda directa",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(100)]])],
                [2, new Map([[3, newPrice(100)]])],
                [3, new Map([[4, newPrice(100)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, zeroValue()], [3, zeroValue()], [4, newPrice(100)]])],
                [2, new Map([[3, zeroValue()]])],
                [3, new Map([[4, zeroValue()]])]
            ])
        },
        {
            // 3 participantes con deudas cruzadas: 1→2:5, 1→3:10, 2→3:1, 3→1:3, 3→2:6
            // Par (1,2): net=5, via=2, dest=3: netViaDest=6-1=5>0 → NO cadena
            // Par (1,3): net=10-3=7, via=3, dest=2: netViaDest=1-6=-5<0 → cadena 1→3→2, diff=min(7,5)=5
            //   → 1→3:10-5=5, 1→2:5+5=10, 3→2:6-5=1
            // Par (2,3): net=1-1=0 → skip
            // Resultado: 1→2:10, 1→3:5, 2→3:1, 3→1:3, 3→2:1
            name: "3 participantes con deudas cruzadas: solo una cadena válida, resto intacto (test 7)",
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
            // 1→2:200, 2→1:100, 2→3:100, 3→4:100
            // Par (1,2): net=200-100=100, via=2, dest=3: cadena 1→2→3, diff=min(100,100)=100
            //   → 1→2:100, 1→3:100, 2→3:0
            // Par (1,3): net=100, via=3, dest=4: cadena 1→3→4, diff=min(100,100)=100
            //   → 1→3:0, 1→4:100, 3→4:0
            // Par (2,1): net=100-100=0 → skip
            // Resultado: 1→2:100, 1→3:0, 1→4:100, 2→1:100, 2→3:0, 3→4:0
            // (las mutuas 1↔2 quedan porque eso lo resuelve cancelMutualDebts)
            name: "4 participantes con deuda mutua + cascada: redirige cascada, deja mutuas intactas (test 8)",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(200)]])],
                [2, new Map([[1, newPrice(100)], [3, newPrice(100)]])],
                [3, new Map([[4, newPrice(100)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(100)], [3, zeroValue()], [4, newPrice(100)]])],
                [2, new Map([[1, newPrice(100)], [3, zeroValue()]])],
                [3, new Map([[4, zeroValue()]])]
            ])
        }
    ];

    tests.forEach(test => {
        it(test.name, () => {
            const result = eliminateIntermediaries(test.input, test.participantIds);
            expect(areDebitCreditMapsEqual(result, test.expected)).toBe(true);
        });
    });
});

describe('simplifyBalance', () => {
    const tests: {
        name: string;
        participantIds: number[];
        input: DebitCreditMap;
        expected: DebitCreditMap;
    }[] = [
        {
            // Deudas cruzadas entre 3. Pasada 1 redirige cadena 1→3→2 (diff=5),
            // luego cancelMutualDebts netea las mutuas restantes.
            // Resultado: solo quedan 2 deudas netas: 1→2:10 y 1→3:2
            name: "3 participantes: cadena + cancelación bilateral deja solo deudas netas",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[2, newPrice(5)], [3, newPrice(10)]])],
                [2, new Map([[3, newPrice(1)]])],
                [3, new Map([[1, newPrice(3)], [2, newPrice(6)]])]
            ]),
            expected: new Map([
                [1, new Map([[2, newPrice(10)], [3, newPrice(2)]])]
            ])
        },
        {
            // Simétrico al anterior. Cadena 2→3→1 se redirige,
            // cancelMutualDebts netea las mutuas.
            // Resultado: 2→1:10 y 3→1:2
            name: "3 participantes: cadena invertida + cancelación bilateral",
            participantIds: [1, 2, 3],
            input: new Map([
                [1, new Map([[3, newPrice(3)]])],
                [2, new Map([[1, newPrice(5)], [3, newPrice(6)]])],
                [3, new Map([[1, newPrice(10)], [2, newPrice(1)]])]
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(10)]])],
                [3, new Map([[1, newPrice(2)]])]
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
            // Cadena 1→2→3→4. Pasada 1 cascadea: 1→2→3, 1→3→4, 2→3→4.
            // cancelMutualDebts limpia los ceros.
            // Resultado: 1→4:3, 2→3:3, 2→4:4
            name: "4 participantes: cadena larga 1→2→3→4 se simplifica eliminando intermediarios",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[2, newPrice(3)]])],
                [2, new Map([[3, newPrice(10)]])],
                [3, new Map([[4, newPrice(7)]])]
            ]),
            expected: new Map([
                [1, new Map([[4, newPrice(3)]])],
                [2, new Map([[3, newPrice(3)], [4, newPrice(4)]])]
            ])
        },
        {
            // 4 participantes con deudas cruzadas.
            // Pasada 1: cadena 2→1→3 + cadena 2→4→3. cancelMutualDebts netea 2↔3.
            // Resultado: 1→3:5, 2→3:6, 4→3:6 (todos le deben a 3)
            name: "4 participantes: deudas cruzadas se simplifican a 3 deudas netas",
            participantIds: [1, 2, 3, 4],
            input: new Map([
                [1, new Map([[3, newPrice(15)]])],
                [2, new Map([[1, newPrice(10)], [4, newPrice(3)]])],
                [3, new Map([[2, newPrice(7)]])],
                [4, new Map([[3, newPrice(9)]])]
            ]),
            expected: new Map([
                [1, new Map([[3, newPrice(5)]])],
                [2, new Map([[3, newPrice(6)]])],
                [4, new Map([[3, newPrice(6)]])]
            ])
        },
        {
            // Cadena 2→1→3: diff=4. cancelMutualDebts limpia 1→3=0.
            // Resultado: 2→1:6, 2→3:8
            name: "3 participantes: elimina intermediario 1 en cadena 2→1→3 (scaled x10)",
            participantIds: [1, 2, 3],
            input: new Map([
                [2, new Map([[1, newPrice(10)], [3, newPrice(4)]])],
                [1, new Map([[3, newPrice(4)]])]
            ]),
            expected: new Map([
                [2, new Map([[1, newPrice(6)], [3, newPrice(8)]])]
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
            const result = simplifyBalance(test.input, test.participantIds);
            expect(areDebitCreditMapsEqual(result, test.expected)).toBe(true);
        });
    });
});

describe('simplifyBalance - casos antes problemáticos (resueltos con múltiples pasadas)', () => {
    // Antes fallaba: pasada 1 redirige 1→3→2, creando 1→2:100.
    // La nueva cadena 1→2→4 no se detectaba porque par (1,2) ya fue procesado.
    // Con múltiples pasadas: pasada 2 detecta 1→2→4 y redirige a 1→4 directo.
    it('cadena 1→3→2→4: múltiples pasadas detectan cadena creada por redirección', () => {
        const input: DebitCreditMap = new Map([
            [1, new Map([[3, newPrice(100)]])],
            [3, new Map([[2, newPrice(100)]])],
            [2, new Map([[4, newPrice(100)]])]
        ]);
        const expected: DebitCreditMap = new Map([
            [1, new Map([[4, newPrice(100)]])]
        ]);
        const result = simplifyBalance(input, [1, 2, 3, 4]);
        expect(areDebitCreditMapsEqual(result, expected)).toBe(true);
    });

    // Antes fallaba: cadena de 5 participantes no se simplificaba del todo.
    // Con múltiples pasadas: se resuelve completamente.
    it('cadena de 5 participantes 1→2→3→4→5 se simplifica completamente', () => {
        const input: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(50)]])],
            [2, new Map([[3, newPrice(100)]])],
            [3, new Map([[4, newPrice(100)]])],
            [4, new Map([[5, newPrice(100)]])]
        ]);
        const expected: DebitCreditMap = new Map([
            [1, new Map([[5, newPrice(50)]])],
            [2, new Map([[5, newPrice(50)]])]
        ]);
        const result = simplifyBalance(input, [1, 2, 3, 4, 5]);
        expect(areDebitCreditMapsEqual(result, expected)).toBe(true);
    });

    // Antes fallaba: ciclo perfecto 1→2→3→1 no se cancelaba.
    // Con múltiples pasadas: pasada 1 redirige 1→2→3 creando 1→3:100 mutual con 3→1:100,
    // cancelMutualDebts las cancela → mapa vacío.
    it('ciclo perfecto 1→2→3→1 se cancela completamente', () => {
        const input: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(100)]])],
            [2, new Map([[3, newPrice(100)]])],
            [3, new Map([[1, newPrice(100)]])]
        ]);
        const expected: DebitCreditMap = new Map();
        const result = simplifyBalance(input, [1, 2, 3]);
        expect(areDebitCreditMapsEqual(result, expected)).toBe(true);
    });
});

describe('simplifyBalance - limitación inherente (NP-hard)', () => {
    // ⚠️ Este test documenta un caso que el algoritmo NO puede resolver.
    // No es un bug: es una limitación teórica del enfoque basado en cadenas (i→j→k).
    //
    // Cuando ningún participante es intermediario (nadie debe y cobra a la vez),
    // no existe cadena que redirigir. El algoritmo no toca nada.
    // La solución óptima requiere reagrupar pagos globalmente (zero-sum set packing, NP-hard).
    //
    // Deudas: 1→2:5, 1→3:5, 4→2:5, 4→3:5   (4 transferencias)
    // Óptimo: 1→2:10, 4→3:10                  (2 transferencias)
    it('EXPECTED LIMITATION - sin intermediarios: no puede reagrupar pagos globalmente', () => {
        const input: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(5)], [3, newPrice(5)]])],
            [4, new Map([[2, newPrice(5)], [3, newPrice(5)]])]
        ]);
        const optimal: DebitCreditMap = new Map([
            [1, new Map([[2, newPrice(10)]])],
            [4, new Map([[3, newPrice(10)]])]
        ]);
        const result = simplifyBalance(input, [1, 2, 3, 4]);
        // El resultado NO es óptimo: el algoritmo devuelve las 4 deudas originales sin cambios
        expect(areDebitCreditMapsEqual(result, optimal)).toBe(false);
        expect(areDebitCreditMapsEqual(result, input)).toBe(true);
    });
});

describe('ensureMovementAmountIsNotZero', () => {
    it('should throw MovementError when movement amount is zero', () => {
        const movement: Movement = {
            id: 1,
            type: MovementType.expense,
            amount: newPrice(0),
            createdAt: 0,
            concept: "Test",
            groupId: 1
        };
        let threw = false;
        try {
            ensureMovementAmountIsNotZero(movement);
        } catch (error) {
            threw = true;
            expect(error instanceof MovementError).toBe(true);
        }
        expect(threw).toBe(true);
    });

    it('should not throw when movement amount is greater than zero', () => {
        const movement: Movement = {
            id: 1,
            type: MovementType.expense,
            amount: newPrice(1000),
            createdAt: 0,
            concept: "Test",
            groupId: 1
        };
        let threw = false;
        try {
            ensureMovementAmountIsNotZero(movement);
        } catch (error) {
            threw = true;
        }
        expect(threw).toBe(false);
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
function expect(actual: Price): { toBe(expected: Price): void };

function expect(actual: boolean | number | Price) {
    return {
        toBe: (expected: boolean | number | Price) => {
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

function isNumber(obj: any): obj is Price {
  return obj && typeof obj.equals === 'function';
}
