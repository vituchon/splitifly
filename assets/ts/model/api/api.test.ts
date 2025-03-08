import {
    createGroup,
    addParticipant,
    addExpenseMovement,
    calculateAggregatedBalances,
    calculateBalance
} from './api';
import { Movement, DebitCreditMap, ParticipantShareByParticipantId, sumDebitCreditMaps, sumParticipantShares } from '../movement';
import { newPrice } from '../price';
import { _Number } from '../../util/number';


describe('API Integration Tests', () => {
    interface Movement {
      groupId: number;
      amount: _Number;
      concept: string;
      participantMovements: { participantId: number; amount: _Number; }[];
    }

    describe('Normal API flow from good client', () => {
        it('should handle complete flow', async () => {
            // Create group
            const group = await createGroup("Group 1");
            expect(group.name).toBe("Group 1");

            // Add participants
            const participants = ["Vitu", "Chori", "Junior"];
            const participantModels = await Promise.all(
                participants.map(name =>
                    addParticipant({ groupId: group.id, name })
                )
            );

            const [participantId1, participantId2, participantId3] = participantModels.map(p => p.id);

            // Add movements
            const movements: Movement[] = [
                {
                    groupId: group.id,
                    amount: newPrice(1000),
                    concept: "Almuerzo",
                    participantMovements: [
                        { participantId: participantId1, amount: newPrice(600) },
                        { participantId: participantId2, amount: newPrice(400) }
                    ]
                },
                {
                    groupId: group.id,
                    amount: newPrice(1500),
                    concept: "Merienda",
                    participantMovements: [
                        { participantId: participantId1, amount: newPrice(500) },
                        { participantId: participantId2, amount: newPrice(500) },
                        { participantId: participantId3, amount: newPrice(500) }
                    ]
                },
                {
                    groupId: group.id,
                    amount: newPrice(900),
                    concept: "Cena",
                    participantMovements: [
                        { participantId: participantId1, amount: newPrice(300) },
                        { participantId: participantId2, amount: newPrice(300) },
                        { participantId: participantId3, amount: newPrice(300) }
                    ]
                }
            ];

            const addedMovements = await Promise.all(
                movements.map(m => addExpenseMovement(m))
            );

            // Calculate and verify balances
            const [generatedBalance, shares] = await calculateAggregatedBalances(group.id);

            const expectedBalance = new Map([
                [participantId2, new Map([[participantId1, newPrice(100)]])],
            ]);

            const expectedShares = new Map([
                [participantId1, newPrice(100)],
                [participantId2, newPrice(-100)],
                [participantId3, newPrice(0)],
            ]);

            expect(areDebitCreditMapsEqual(generatedBalance, expectedBalance)).toBe(true);
            expect(areParticipantSharesEqual(shares, expectedShares)).toBe(true);
        });
    });

    describe('Step by step API flow', () => {
        interface MovementTest {
            name: string;
            movement: Movement;
            expectedMap: DebitCreditMap;
            expectedAccumulatedMap: DebitCreditMap;
            expectedShares: ParticipantShareByParticipantId;
            expectedAccumulatedShares: ParticipantShareByParticipantId;
        }

        it('should handle movements step by step', async () => {
            const group = await createGroup("Group 1");

            // Add participants
            const participants = ["Vitu", "Chori", "Junior"];
            const participantModels = await Promise.all(
                participants.map(name =>
                    addParticipant({ groupId: group.id, name })
                )
            );

            const [participantId1, participantId2, participantId3] = participantModels.map(p => p.id);

            const tests: MovementTest[] = [
                {
                    name: "Almuerzo",
                    movement: {
                        groupId: group.id,
                        amount: newPrice(1000),
                        concept: "Almuerzo",
                        participantMovements: [
                            { participantId: participantId1, amount: newPrice(600) },
                            { participantId: participantId2, amount: newPrice(400) }
                        ]
                    },
                    expectedMap: new Map([[participantId2, new Map([[participantId1, newPrice(100)]])]]),
                    expectedAccumulatedMap: new Map([[participantId2, new Map([[participantId1, newPrice(100)]])]]),
                    expectedShares: new Map([
                        [participantId1, newPrice(100)],
                        [participantId2, newPrice(-100)]
                    ]),
                    expectedAccumulatedShares: new Map([
                        [participantId1, newPrice(100)],
                        [participantId2, newPrice(-100)]
                    ])
                },
                // ... Add other test cases here following the same pattern
            ];

            let accumulatedMap = new Map();
            let accumulatedShares = new Map();

            for (const test of tests) {
                console.log(test.name);
                const [movement] = await addExpenseMovement(test.movement);
                const [generatedMap, generatedShares] = await calculateBalance(group.id, movement.id);

                expect(areDebitCreditMapsEqual(generatedMap, test.expectedMap)).toBe(true);
                expect(areParticipantSharesEqual(generatedShares, test.expectedShares)).toBe(true);

                accumulatedMap = sumDebitCreditMaps(accumulatedMap, generatedMap);
                expect(areDebitCreditMapsEqual(accumulatedMap, test.expectedAccumulatedMap)).toBe(true);

                accumulatedShares = sumParticipantShares(accumulatedShares, generatedShares);
                expect(areParticipantSharesEqual(accumulatedShares, test.expectedAccumulatedShares)).toBe(true);
            }
        });
    });
});

// Helper functions (same as in movement.test.ts)

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

// Minimal testing framework
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
function expect(actual: string): { toBe(expected: string): void };
function expect(actual: _Number): { toBe(expected: _Number): void };

function expect(actual: boolean | number | string | _Number) {
  return {
      toBe: (expected: boolean | number | string | _Number) => {
          if (typeof actual === 'boolean' && typeof expected === 'boolean') {
              if (actual !== expected) {
                  throw new Error(`Expected ${expected} but got ${actual}`);
              }
          } else if (typeof actual === 'number' && typeof expected === 'number') {
              if (actual !== expected) {
                  throw new Error(`Expected ${expected} but got ${actual}`);
              }
          } else if (typeof actual === 'string' && typeof expected === 'string') {
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
  }
}

function isNumber(obj: any): obj is _Number {
  return obj && typeof obj.equals === 'function';
}
