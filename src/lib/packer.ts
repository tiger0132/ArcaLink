/*
fk ts

typing 写起来太恶心了
希望有人能帮忙补个阳间的 typing
PRs welcome
*/

abstract class TypeBaseX<BaseType, InType, Name extends string> {
  public value?: BaseType;
  public type!: InType;
  public name!: Name;
  // format: unknown;
  format(..._args: InType extends undefined ? [] : [InType]): Buffer { throw new Error('Not implemented'); };
  parse(_buf: Buffer, _offset: number = 0): readonly [BaseType, number] { throw new Error('Not implemented'); };
  structure(): any { throw new Error('Not implemented'); }
  // constructor(public name: string) { }
}
type TypeBaseAny = TypeBaseX<unknown, unknown, string>;

type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
function leafFactory<BaseType>(
  size: number,
  fnRead: KeysMatching<Buffer, (x: number) => BaseType>,
  fnWrite: KeysMatching<Buffer, (x: BaseType) => number>
) {
  return class LeafType<
    Name extends string,
    T extends BaseType | undefined,
    InType = T extends undefined ? BaseType : undefined
    > extends TypeBaseX<BaseType, InType, Name> {
    constructor(public name: Name, public value: T) { super(); }
    format(...[value]: InType extends undefined ? [] : [InType]) {
      if (value === undefined && this.value === undefined)
        throw new Error(`${this.name} is undefined`);
      let buf = Buffer.alloc(size);
      (buf[fnWrite] as unknown as (_: BaseType) => number)((value ?? this.value) as BaseType);
      return buf;
    }
    parse(buf: Buffer, offset: number = 0) {
      return [(buf[fnRead] as unknown as (_: number) => BaseType)(offset), offset + size] as const;
    }
    structure() { return size; }
  };
}
const TypeU8 = leafFactory<number>(1, 'readUInt8', 'writeUInt8');
const TypeU16 = leafFactory<number>(2, 'readUInt16LE', 'writeUInt16LE');
const TypeU32 = leafFactory<number>(4, 'readUInt32LE', 'writeUInt32LE');
const TypeU64 = leafFactory<bigint>(8, 'readBigUInt64LE', 'writeBigUInt64LE');
const TypeI8 = leafFactory<number>(1, 'readInt8', 'writeInt8');
const TypeI16 = leafFactory<number>(2, 'readInt16LE', 'writeInt16LE');
const TypeI32 = leafFactory<number>(4, 'readInt32LE', 'writeInt32LE');
const TypeI64 = leafFactory<bigint>(8, 'readBigInt64LE', 'writeBigInt64LE');

class TypeBuffer<
  Name extends string,
  T extends Buffer | undefined,
  InType = T extends undefined ? Buffer : undefined
  > extends TypeBaseX<Buffer, InType, Name> {
  constructor(public name: Name, public size: number, public value: T) {
    super();
    if (value && value.length !== this.size)
      throw new Error(`${this.name} is not ${this.size} bytes`);
  }
  format(...[value]: InType extends undefined ? [] : [InType]) {
    if (value === undefined && this.value === undefined)
      throw new Error(`${this.name} is undefined`);
    let buf = (value ?? this.value) as Buffer;
    if (buf.length !== this.size)
      throw new Error(`${this.name} is not ${this.size} bytes`);
    return buf;
  }
  parse(buf: Buffer, offset: number = 0) {
    return [buf.slice(offset, offset + this.size), offset + this.size] as const;
  }
  structure() { return this.size; }
}

class TypeFixedString<
  Name extends string,
  T extends string | undefined,
  InType = T extends undefined ? string : undefined
  > extends TypeBaseX<string, InType, Name> {
  constructor(public name: Name, private size: number, public value: T) {
    super();
    if (value && value.length > this.size)
      throw new Error(`${this.name} is too long`);
  }
  format(...[value]: InType extends undefined ? [] : [InType]) {
    if (value === undefined && this.value === undefined)
      throw new Error(`${this.name} is undefined`);
    let buf = Buffer.from((value ?? this.value) as string).slice(0, this.size);
    if (buf.length < this.size)
      return Buffer.concat([buf, Buffer.alloc(16 - this.size)]);
    return buf;
  }
  parse(buf: Buffer, offset: number = 0) {
    return [buf.slice(offset, offset + this.size).toString('ascii'), offset + this.size] as const;
  }
  structure() { return this.size; }
}

export type Tuple<T, N extends number, A extends any[] = []> = A extends { length: N } ? A : Tuple<T, N, [...A, T]>;
class TypeFixedArray<
  Name extends string,
  Size extends number,
  T extends TypeBaseAny,
  InType = Tuple<T['type'], Size> // format 里输入的内容
  > extends TypeBaseX<InType, InType, Name> {
  constructor(public name: Name, private len: Size, private field: T) { super(); }
  format(...[_value]: InType extends undefined ? [] : [InType]) {
    if (!_value)
      throw new Error(`${this.name} should not be undefined`);
    let value = _value as unknown as T['type'][];
    if (value.length !== this.len)
      throw new Error(`${this.name} is not ${this.len} elements`);
    let bufs = [];
    for (let x of value)
      bufs.push(this.field.format(x));
    return Buffer.concat(bufs);
  }
  parse(buf: Buffer, offset: number = 0) {
    let result = [], parsed;
    for (let i = 0; i < this.len; i++) {
      [parsed, offset] = this.field.parse(buf, offset) as [T['type'], number];
      result.push(parsed);
    }
    return [result as unknown as InType, offset] as const;
  }
  structure() { return new Array(this.len).fill(this.field.structure()); }
};

type Values<T extends TypeBaseAny[]> =
  T extends [infer T, ...infer U] ?
  T extends TypeBaseAny ?
  U extends TypeBaseAny[] ?
  undefined extends T['type'] ?
  Values<U> :
  { [p in T['name']]: T['type'] } & Values<U> :
  never : never : {};
class TypeStruct<
  Name extends string,
  T extends (number extends T['length'] ? [] : TypeBaseAny[]),
  InType = Values<T> // format 里输入的内容
  > extends TypeBaseX<InType, InType, Name> {
  constructor(public name: Name, public fields: T) { super(); }
  format(...[_value]: InType extends undefined ? [] : [InType]) {
    if (!_value)
      throw new Error(`${this.name} should not be undefined`);
    let bufs = [];
    for (let x of this.fields)
      bufs.push(x.format(_value[x.name as keyof InType] as any));
    return Buffer.concat(bufs);
  }
  parse(buf: Buffer, offset: number = 0) {
    let result = {} as InType, parsed;
    for (let x of this.fields) {
      [parsed, offset] = x.parse(buf, offset);
      (result as any)[x.name] = parsed;
    }
    return [result, offset] as const;
  }
  structure() {
    let result = {} as any;
    for (let x of this.fields)
      result[x.name] = x.structure();
    return result;
  }
}

type Fuck<T, U> = T extends [] ? undefined : U;
class FieldWrapper<Name extends string> {
  constructor(private name: Name) { }

  // 我只是想让它在不填的时候推导出 undefined，否则推导出 number / bigint / string / Buffer 什么的
  u8 = <T extends [number] | []>(...x: T) => new TypeU8(this.name, x[0] as Fuck<T, number>);
  u16 = <T extends [number] | []>(...x: T) => new TypeU16(this.name, x[0] as Fuck<T, number>);
  u32 = <T extends [number] | []>(...x: T) => new TypeU32(this.name, x[0] as Fuck<T, number>);
  u64 = <T extends [bigint] | []>(...x: T) => new TypeU64(this.name, x[0] as Fuck<T, bigint>);
  i8 = <T extends [number] | []>(...x: T) => new TypeI8(this.name, x[0] as Fuck<T, number>);
  i16 = <T extends [number] | []>(...x: T) => new TypeI16(this.name, x[0] as Fuck<T, number>);
  i32 = <T extends [number] | []>(...x: T) => new TypeI32(this.name, x[0] as Fuck<T, number>);
  i64 = <T extends [bigint] | []>(...x: T) => new TypeI64(this.name, x[0] as Fuck<T, bigint>);
  str = <T extends [string] | []>(size: number, ...x: T) => new TypeFixedString(this.name, size, x[0] as Fuck<T, string>);
  buf = <T extends [Buffer] | []>(size: number, ...x: T) => new TypeBuffer(this.name, size, x[0] as Fuck<T, Buffer>);

  struct = <T extends (number extends T['length'] ? [] : TypeBaseAny[])>
    (fields: T) => new TypeStruct(this.name, fields);
  array = <Size extends number, T extends TypeBaseAny>
    (size: Size, field: T) => new TypeFixedArray(this.name, size, field);
};

/*
傻逼语言，
new FieldWrapper(name.length ? name[0] ?? '' : ''); 给我报错
new FieldWrapper(0 in name ? name[0] ?? '' : ''); 也给我报错
*/
export const p =
  <T extends string = ''>(...name: T extends '' ? [] : [T]) =>
    new FieldWrapper<T>((name as any)[0] ?? '');
export type typeOf<T extends TypeBaseAny> = T['type'];