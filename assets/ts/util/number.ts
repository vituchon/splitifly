export interface _Number<T extends _Number<T>> {
  add(other: T): T;
  subtract(other: T): T;
  multiply(other: T): T;
  divide(other: T): T;
  negate(): T;
  abs(): T;
  toNumber(): number;
  toString(): string;
  compareTo(other: T): number;
  equals(other: T): boolean;
  isLowerStrict(other: T): boolean;
  isLowerOrEquals(other: T): boolean;
  isHigherStrict(other: T): boolean;
  isHigherOrEquals(other: T): boolean;
}

export class NativeNumber implements _Number<NativeNumber> {
  public value: number;
  public static ONE: NativeNumber = new NativeNumber(1);
  public static ZERO: NativeNumber = new NativeNumber(0)

  private constructor(value: number) {
    this.value = value
  }

  static fromInteger(num: number): NativeNumber {
    return new NativeNumber(num);
  }

  static fromFraction(numerator: number, denominator: number): NativeNumber {
    if (denominator === 0) {
      throw new Error("Denominator cannot be zero");
    }
    return new NativeNumber(numerator / denominator);
  }

  static fromDecimalString(number: string, sep: string): NativeNumber {
    const sepPos = number.indexOf(sep);
    if (sepPos !== -1) {
      const integerPart = number.substring(0, sepPos) || "0";
      const decimalPart = number.substring(sepPos + 1).replace(/0+$/, "");
      const isNegative = number[0] === '-'
      const denominator = Math.pow(10, decimalPart.length);
      const numerator = parseInt(integerPart) * denominator + parseInt(decimalPart) * (isNegative ? -1 : 1)
      return new NativeNumber(numerator / denominator);
    } else {
      return new NativeNumber(parseInt(number));
    }
  }

  add(other: NativeNumber): NativeNumber {
    return new NativeNumber(this.value + other.value);
  }

  subtract(other: NativeNumber): NativeNumber {
    return new NativeNumber(this.value - other.value);
  }

  multiply(other: NativeNumber): NativeNumber {
    return new NativeNumber(this.value * other.value);
  }

  divide(other: NativeNumber): NativeNumber {
    if (other.value === 0) {
      throw new Error("Cannot divide by zero");
    }
    return new NativeNumber(this.value / other.value);
  }

  abs(): NativeNumber {
    if (this.value < 0) {
      return new NativeNumber(-this.value);
    } else {
      return new NativeNumber(this.value);
    }
  }

  negate(): NativeNumber {
    return new NativeNumber(-this.value);
  }

  compareTo(other: NativeNumber): number{
      // La comparación la restringo a objetos del mismo tipo
      if (this.value < other.value) { //Si el de arriba (an * bd) es mayor (resultado mayor a 1) entonces este objeto es mayor al otro
        return -1;
      } else if (this.value === other.value) {//si son iguales (resultado igual a 1) entonces son iguales
        return 0;
      } else { //si es menor (resulado mener a 1) entonces es menor
        return 1;
      }
  }

  toNumber(): number {
    return this.value
  }

  toString(): string {
    return `${this.value}`;
  }

  equals(other: NativeNumber): boolean {
    return this.compareTo(other) === 0
  }

  isLowerStrict(other: NativeNumber): boolean {
    return this.compareTo(other) < 0
  }

  isLowerOrEquals(other: NativeNumber): boolean {
    return this.compareTo(other) <= 0
  }

  isHigherStrict(other: NativeNumber): boolean {
    return this.compareTo(other) > 0
  }

  isHigherOrEquals(other: NativeNumber): boolean {
    return this.compareTo(other) >= 0
  }

  /**
   * The `toJSON()` method is automatically called by `JSON.stringify()` to customize the
   * JSON representation of an object. It returns the value to be serialized.
   *
   * @returns {unknown} The value of the `value` property, which will be serialized.
   */
  toJSON(): unknown {
    return this.value;
  }
}
