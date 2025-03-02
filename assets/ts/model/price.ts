import Fraction from "../util/fraction";
import { _Number } from "../util/number";

export type Price = _Number;
/*
// some funcy idea to play with....
interface NumberBuilder {
  from(value: number): _Number
}

class FractionNumberBuilder implements NumberBuilder {
  from(value: number): _Number {
    if (value === 0) {
      return Fraction.ZERO
    }
    if (value === 1) {
      return Fraction.ONE
    }
    return Fraction.fromInteger(value)
  }
}

const actualNumberBuilder = new FractionNumberBuilder()

export function newPrice(amount: number, currency: string = "ARS") : Price {
  return actualNumberBuilder.from(amount)
}*/

export function newPrice(amount: number, currency: string = "ARS") : Price {
  if (amount === 0) {
    return Fraction.ZERO
  }
  if (amount === 1) {
    return Fraction.ONE
  }
  return Fraction.fromInteger(amount)
}

export function fromFractionJson(value: any) {
  return Fraction.fromFraction(value.numerator, value.denominator);
}

export function fromNumberJson(value: any) {
  return Fraction.fromInteger(value);
}

export function parsePrice(number: string): Price {
  return Fraction.fromDecimal(number, ".")
}

export function stringifyPrice(amount: Price): string {
  return amount.toNumber().toString()
}

export function zeroValue(): Price {
  return Fraction.ZERO
}

/*
// uncomment if you wanna use native js numbers as underlying numrical "data structure"
export function newPrice(amount: number, currency: string = "ARS") : Price {
  if (amount === 0) {
    return NativeNumber.ZERO
  }
  if (amount === 1) {
    return NativeNumber.ONE
  }
  return NativeNumber.fromInteger(amount)
}

export function fromFractionJson(value: any) {
  return NativeNumber.fromFraction(value.numerator, value.denominator);
}

export function fromNumberJson(value: any) {
  return NativeNumber.fromInteger(value);
}

export function parsePrice(number: string): Price {
  return NativeNumber.fromDecimalString(number, ".")
}

export function stringifyPrice(amount: Price): string {
  return amount.toNumber().toString()
}

export function zeroValue(): Price {
  return NativeNumber.ZERO
}*/




