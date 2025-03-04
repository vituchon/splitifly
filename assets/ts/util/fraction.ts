import { _Number } from "./number";

export class Fraction implements _Number {
  public numerator: number;
  public denominator: number;
  public static ZERO: Fraction = new Fraction(0, 1);
  public static ONE: Fraction = new Fraction(1, 1);

  private constructor(numerator: number, denominator: number) {
    const gcd = Fraction.gcd(Math.abs(numerator), Math.abs(denominator));
    const sign = Math.sign(denominator);
    this.numerator = (numerator / gcd) * sign; // dev notes: the numerator "carry" the sign
    this.denominator = Math.abs(denominator / gcd);
  }

  static fromInteger(num: number): Fraction {
    return new Fraction(num, 1);
  }

  static fromFraction(numerator: number, denominator: number): Fraction {
    if (denominator === 0) {
      throw new Error("Denominator cannot be zero");
    }
    return new Fraction(numerator, denominator);
  }

  static fromDecimal(number: string, sep: string): Fraction {
    const sepPos = number.indexOf(sep);
    if (sepPos !== -1) {
      const integerPart = number.substring(0, sepPos) || "0";
      const decimalPart = number.substring(sepPos + 1).replace(/0+$/, "") || "0";
      const isNegative = number[0] === '-'
      const denominator = Math.pow(10, decimalPart.length);
      const numerator = parseInt(integerPart) * denominator + parseInt(decimalPart) * (isNegative ? -1 : 1)

      return new Fraction(numerator, denominator);
    } else {
      return new Fraction(parseInt(number), 1);
    }
  }

  // Greatest Common Divisor calculation
  private static gcd(a: number, b: number): number {
    return b === 0 ? a : Fraction.gcd(b, a % b);
  }

  add(_other: _Number): Fraction {
    const other = _other as unknown as Fraction
    const newNumerator = this.numerator * other.denominator + other.numerator * this.denominator;
    const newDenominator = this.denominator * other.denominator;
    return new Fraction(newNumerator, newDenominator);
  }

  subtract(_other: _Number): Fraction {
    const other = _other as unknown as Fraction
    const newNumerator = this.numerator * other.denominator - other.numerator * this.denominator;
    const newDenominator = this.denominator * other.denominator;
    return new Fraction(newNumerator, newDenominator);
  }

  multiply(_other: _Number): Fraction {
    const other = _other as unknown as Fraction
    return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  divide(_other: _Number): Fraction {
    const other = _other as unknown as Fraction
    if (other.numerator === 0) {
      throw new Error("Cannot divide by zero");
    }
    return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  negate(): Fraction {
    return new Fraction(-this.numerator, this.denominator);
  }

  compareTo(_other: _Number): number{
      // La comparación la restringo a objetos del mismo tipo
      const other = _other as unknown as Fraction
      const an = this.numerator;
      const ad = this.denominator;
      const bn = other.numerator;
      const bd = other.denominator;
      // Divido las dos fracciones usando la propiedad de (an/ad) : (bn/bd) = (an/ad * bd/bd)
      const left = an * bd
      const right = bn * ad;
      if (left < right) { //Si el de arriba (an * bd) es mayor (resultado mayor a 1) entonces este objeto es mayor al otro
        return -1;
      } else if (left === right) {//si son iguales (resultado igual a 1) entonces son iguales
        return 0;
      } else { //si es menor (resulado mener a 1) entonces es menor
        return 1;
      }
  }

  toNumber(): number {
    return this.numerator / this.denominator;
  }

  toString(): string {
    return `${this.numerator}/${this.denominator}`;
  }

  equals(other: _Number): boolean {
    return this.compareTo(other) === 0
  }

  isLowerStrict(other: _Number): boolean {
    return this.compareTo(other) < 0
  }

  isLowerOrEquals(other: _Number): boolean {
    return this.compareTo(other) <= 0
  }

  isHigherStrict(other: _Number): boolean {
    return this.compareTo(other) > 0
  }

  isHigherOrEquals(other: _Number): boolean {
    return this.compareTo(other) >= 0
  }
}

export default Fraction;

