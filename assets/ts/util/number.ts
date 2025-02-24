export interface _Number {
  add(other: _Number): _Number;
  subtract(other: _Number): _Number;
  multiply(other: _Number): _Number;
  divide(other: _Number): _Number;
  toNumber(): number;
  toString(): string;
  equals(other: _Number): boolean;
}