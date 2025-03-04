import Fraction from "../util/fraction";
import { _Number } from "../util/number";

export type Price = _Number;
/*
// some funcy idea to play with....
interface PriceBuilder {
  newPrice(amount: number, currency: string) : Price
  fromJsonFraction(value: any) : Price
  fromJsonNumber(value: any) : Price
  parsePrice(number: string): Price
  stringifyPrice(amount: Price): string
  zeroValue(): Price
}
// so i can define a class like this...
class PriceFractionBasedBuilder implements PriceBuilder {
  newPrice(value: number, currency: string = "ARS"): _Number {
    if (value === 0) {
      return Fraction.ZERO
    }
    if (value === 1) {
      return Fraction.ONE
    }
    return Fraction.fromInteger(value)
  }
  fromJsonFraction(value: any): _Number {
    return Fraction.fromFraction(value.numerator, value.denominator);
  }
  fromJsonNumber(value: any): _Number {
    return Fraction.fromInteger(value);
  }
  parsePrice(number: string): _Number {
    return Fraction.fromDecimal(number, ".")
  }
  stringifyPrice(amount: _Number): string {
    return amount.toNumber().toString()
  }
  zeroValue(): _Number {
    return Fraction.ZERO
  }
}
// so I can use an object like this....
const priceBuilder = new PriceFractionBasedBuilder()
*/

export function newPrice(amount: number, currency: string = "ARS") : Price {
  if (amount === 0) {
    return Fraction.ZERO
  }
  if (amount === 1) {
    return Fraction.ONE
  }
  return Fraction.fromInteger(amount)
}

export function fromJsonFraction(value: any) {
  return Fraction.fromFraction(value.numerator, value.denominator);
}

export function fromJsonNumber(value: any) {
  return Fraction.fromInteger(value);
}

export function parsePrice(number: string): Price {
  number = number.replace(/\./g, "").replace(/\$/g,"").trim();
  return Fraction.fromDecimal(number, ",")
}

const amountFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function stringifyPrice(amount: Price): string {
  return amountFormatter.format(amount.toNumber())
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

export function fromJsonFraction(value: any) {
  return NativeNumber.fromFraction(value.numerator, value.denominator);
}

export function fromJsonNumber(value: any) {
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




