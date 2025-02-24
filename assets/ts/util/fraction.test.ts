import Fraction from './fraction';

// Tests para Fraction usando describe, it, expect

describe('Fraction', () => {
    describe('Creación', () => {
        it('debería crear una fracción y simplificarla', () => {
            const frac = Fraction.fromFraction(4, 8);
            expect(frac.numerator.toString()).toBe('1');
            expect(frac.denominator.toString()).toBe('2');
        });

        it('debería lanzar un error si el denominador es cero', () => {
            try {
                Fraction.fromFraction(1, 0);
                throw new Error('No lanzó error');
            } catch (e) {
                expect(e.message).toBe('Denominator cannot be zero');
            }
        });
    });

    describe('Operaciones aritméticas', () => {
        it('debería sumar dos fracciones correctamente', () => {
            const frac1 = Fraction.fromFraction(1, 3);
            const frac2 = Fraction.fromFraction(1, 6);
            const result = frac1.add(frac2);
            expect(result.numerator.toString()).toBe('1');
            expect(result.denominator.toString()).toBe('2');
        });

        it('debería restar dos fracciones correctamente', () => {
            const frac1 = Fraction.fromFraction(3, 4);
            const frac2 = Fraction.fromFraction(1, 4);
            const result = frac1.subtract(frac2);
            expect(result.numerator.toString()).toBe('1');
            expect(result.denominator.toString()).toBe('2');
        });

        it('debería multiplicar dos fracciones correctamente', () => {
            const frac1 = Fraction.fromFraction(2, 3);
            const frac2 = Fraction.fromFraction(3, 4);
            const result = frac1.multiply(frac2);
            expect(result.numerator.toString()).toBe('1');
            expect(result.denominator.toString()).toBe('2');
        });

        it('debería dividir dos fracciones correctamente', () => {
            const frac1 = Fraction.fromFraction(1, 2);
            const frac2 = Fraction.fromFraction(3, 4);
            const result = frac1.divide(frac2);
            expect(result.numerator.toString()).toBe('2');
            expect(result.denominator.toString()).toBe('3');
        });
    });

    describe('Comparaciones', () => {
        it('debería identificar fracciones iguales', () => {
            const frac1 = Fraction.fromFraction(2, 4);
            const frac2 = Fraction.fromFraction(1, 2);
            expect(frac1.equals(frac2)).toBe(true);
        });

        it('debería identificar fracciones diferentes', () => {
            const frac1 = Fraction.fromFraction(1, 3);
            const frac2 = Fraction.fromFraction(1, 4);
            expect(frac1.equals(frac2)).toBe(false);
        });
    });

    describe('Conversión', () => {
        it('debería convertir a decimal correctamente', () => {
            const frac1 = Fraction.fromFraction(1, 4);
            expect(frac1.toNumber()).toBe(0.25);
            expect(frac1.numerator.toString()).toBe('1');
            expect(frac1.denominator.toString()).toBe('4');

            const frac2 = Fraction.fromFraction(-1, 4);
            expect(frac2.toNumber()).toBe(-0.25);
            expect(frac2.numerator.toString()).toBe('-1');
            expect(frac2.denominator.toString()).toBe('4');

            const frac3 = Fraction.fromFraction(1, -4);
            expect(frac3.toNumber()).toBe(-0.25);
            expect(frac3.numerator.toString()).toBe('-1');
            expect(frac3.denominator.toString()).toBe('4');

            const frac4 = Fraction.fromFraction(-1, -4);
            expect(frac4.toNumber()).toBe(0.25);
            expect(frac3.numerator.toString()).toBe('-1');
            expect(frac3.denominator.toString()).toBe('4');
        });

        it('debería devolver una representación en string correcta', () => {
            const frac = Fraction.fromFraction(3, 5);
            expect(frac.toString()).toBe('3/5');
        });
    });

    describe('Construcción', () => {
      it('debería crear una fracción desde una cadena con punto como separador', () => {
        const frac = Fraction.fromString('2.5', '.');
        expect(frac.numerator.toString()).toBe('5');
        expect(frac.denominator.toString()).toBe('2');

        const frac2 = Fraction.fromString('3.75', '.');
        expect(frac2.numerator.toString()).toBe('15');
        expect(frac2.denominator.toString()).toBe('4');
      });

      it('debería crear una fracción desde una cadena con otro separador', () => {
        const frac = Fraction.fromString('2|5', '|');
        expect(frac.numerator.toString()).toBe('5');
        expect(frac.denominator.toString()).toBe('2');
      });

      it('debería crear una fracción desde una cadena sin parte decimal', () => {
        const frac1 = Fraction.fromString('5', '.');
        expect(frac1.numerator.toString()).toBe('5');
        expect(frac1.denominator.toString()).toBe('1');

        const frac2 = Fraction.fromString('0', '.');
        expect(frac2.numerator.toString()).toBe('0');
        expect(frac2.denominator.toString()).toBe('1');
      });

      it('debería no consderar ceros al inicio de la parte entera', () => {
        const frac = Fraction.fromString('0002.5', '.');
        expect(frac.numerator.toString()).toBe('5');
        expect(frac.denominator.toString()).toBe('2');
      });

      it('debería eliminar ceros al final en la parte decimal', () => {
        const frac = Fraction.fromString('2.500', '.');
        expect(frac.numerator.toString()).toBe('5');
        expect(frac.denominator.toString()).toBe('2');
      });

      it('debería manejar números negativos correctamente', () => {
        const frac1 = Fraction.fromString('-5', '.');
        expect(frac1.numerator.toString()).toBe('-5');
        expect(frac1.denominator.toString()).toBe('1');

        const frac2 = Fraction.fromString('-2.5', '.');
        expect(frac2.numerator.toString()).toBe('-5');
        expect(frac2.denominator.toString()).toBe('2');

        const frac3 = Fraction.fromString('-3.75', '.');
        expect(frac3.numerator.toString()).toBe('-15');
        expect(frac3.denominator.toString()).toBe('4');
      });
    })
    describe('Suma de fracciones con signos', () => {
      const frac1 = Fraction.fromFraction(1, 4);   // 0.25
      const frac2 = Fraction.fromFraction(-1, 4);  // -0.25
      const frac3 = Fraction.fromFraction(1, -4);  // -0.25
      const frac4 = Fraction.fromFraction(-1, -4); // 0.25

      const fracs = [frac1, frac2, frac3, frac4];

      const expectedSums = [
          [0.5, 0, 0, 0.5],
          [0, -0.5, -0.5, 0],
          [0, -0.5, -0.5, 0],
          [0.5, 0, 0, 0.5]
      ];

      it('debería sumar todas las combinaciones correctamente', () => {
          for (let i = 0; i < fracs.length; i++) {
              for (let j = 0; j < fracs.length; j++) {
                  const result = fracs[i].add(fracs[j]);
                  expect(result.toNumber()).toBe(expectedSums[i][j]);
                  //console.log(result.toString(), result.toNumber())
              }
          }
      });
  });
});


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

function expect(actual: any) {
  return {
      toBe: (expected: any) => {
          if (actual !== expected) {
              throw new Error(`Expected ${expected} but got ${actual}`);
          }
      }
  };
}
