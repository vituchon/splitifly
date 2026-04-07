import Fraction from "../util/fraction";
import { _Number, NativeNumber } from "../util/number";

// ─── PriceBuilder: Strategy pattern for swapping numerical implementation ───

interface PriceBuilder<T extends _Number<T>> {
  newPrice(amount: number, currency?: string): T;
  fromJsonFraction(value: any): T;
  fromJsonNumber(value: any): T;
  parsePrice(number: string): T;
  stringifyPrice(amount: T): string;
  zeroValue(): T;
}

const amountFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
});

class FractionPriceBuilder implements PriceBuilder<Fraction> {
  newPrice(amount: number, currency: string = "ARS"): Fraction {
    if (amount === 0) return Fraction.ZERO;
    if (amount === 1) return Fraction.ONE;
    return Fraction.fromInteger(amount);
  }
  fromJsonFraction(value: any): Fraction {
    return Fraction.fromFraction(value.numerator, value.denominator);
  }
  fromJsonNumber(value: any): Fraction {
    return Fraction.fromInteger(value);
  }
  parsePrice(number: string): Fraction {
    number = number.replace(/\./g, "").replace(/\$/g, "").trim();
    return Fraction.fromDecimal(number, ",");
  }
  stringifyPrice(amount: Fraction): string {
    return amountFormatter.format(amount.toNumber());
  }
  zeroValue(): Fraction {
    return Fraction.ZERO;
  }
}

class NativeNumberPriceBuilder implements PriceBuilder<NativeNumber> {
  newPrice(amount: number, currency: string = "ARS"): NativeNumber {
    if (amount === 0) return NativeNumber.ZERO;
    if (amount === 1) return NativeNumber.ONE;
    return NativeNumber.fromInteger(amount);
  }
  fromJsonFraction(value: any): NativeNumber {
    return NativeNumber.fromFraction(value.numerator, value.denominator);
  }
  fromJsonNumber(value: any): NativeNumber {
    return NativeNumber.fromInteger(value);
  }
  parsePrice(number: string): NativeNumber {
    number = number.replace(/\./g, "").replace(/\$/g, "").trim();
    return NativeNumber.fromDecimalString(number, ",");
  }
  stringifyPrice(amount: NativeNumber): string {
    return amountFormatter.format(amount.toNumber());
  }
  zeroValue(): NativeNumber {
    return NativeNumber.ZERO;
  }
}

// ═══ SWITCH: cambiar estas 2 líneas para intercambiar implementación ═══
type PriceImpl = Fraction;
const builder: PriceBuilder<PriceImpl> = new FractionPriceBuilder();
// type PriceImpl = NativeNumber;
// const builder: PriceBuilder<PriceImpl> = new NativeNumberPriceBuilder();

export type Price = PriceImpl;

export function newPrice(amount: number, currency: string = "ARS"): Price {
  return builder.newPrice(amount, currency);
}

export function fromJsonFraction(value: any): Price {
  return builder.fromJsonFraction(value);
}

export function fromJsonNumber(value: any): Price {
  return builder.fromJsonNumber(value);
}

export function parsePrice(number: string): Price {
  return builder.parsePrice(number);
}

export function stringifyPrice(amount: Price): string {
  return builder.stringifyPrice(amount);
}

export function zeroValue(): Price {
  return builder.zeroValue();
}
