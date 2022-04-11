import crypto from 'crypto';

export function decryptPack(data: Buffer, key: Buffer) {
  let iv = data.slice(8, 20);
  let authTag = data.slice(20, 32);
  let body = data.slice(32);

  let decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = Buffer.concat([decipher.update(body), decipher.final()]);

  // remove PKCS7 padding
  let pad = decrypted[decrypted.length - 1];
  if (pad > 16) throw new Error('invalid padding');
  return decrypted.slice(0, -pad);
}

export function encryptPack(token: Buffer, body: Buffer, key: Buffer) {
  let iv = crypto.randomBytes(16);

  let cipher = crypto.createCipheriv('aes-128-gcm', key, iv, { authTagLength: 12 });
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(body);
  let final = cipher.final();
  let authTag = cipher.getAuthTag();
  return Buffer.concat([token, iv, authTag, encrypted, final]);

  // TODO: PKCS7 padding
}

export function parseSongMap(songMap: Record<number, [boolean, boolean, boolean, boolean]>) {
  let result = Buffer.alloc(state.common.songMapLen);
  for (let i in songMap) {
    let song = songMap[i];
    let idx = parseInt(i, 10);
    let val = 0;
    val |= (song[0] ? 1 : 0) << 0;
    val |= (song[1] ? 1 : 0) << 1;
    val |= (song[2] ? 1 : 0) << 2;
    val |= (song[3] ? 1 : 0) << 3;
    result[idx >> 1] |= val << ((idx & 1) ? 4 : 0);
  }
  return result;
}

export function toHex(buf: Buffer) {
  return [...buf].map(x => x.toString(16).padStart(2, '0')).join(' ');
}

export function stringifyBuf(buf: Buffer) {
  let result = buf.slice(0, 256).toString('hex');
  if (buf.length > 256) result += ` ... ${buf.length - 256} more bytes`;
  return `<Buffer ${result}>`;
}

export function buf2U64String(buf: Buffer) { return buf.readBigUInt64LE().toString(); }

export type FieldMap = {
  i8: number; u8: number;
  i16: number; u16: number;
  i32: number; u32: number;
  i64: bigint; u64: bigint;
};
export type FieldType = keyof FieldMap | number | `str${number}`;
export type PackSchema = ReadonlyArray<Readonly<[string, FieldType]>>;
export type ParsedType<T> =
  T extends keyof FieldMap ? FieldMap[T] :
  T extends `str${number}` ? string :
  Buffer;
export type ParsedPack<T extends PackSchema> =
  T['length'] extends number ?
  T extends [] ?
  {} :
  T extends readonly [infer T, ...infer U] ?
  T extends PackSchema[number] ?
  U extends PackSchema ?
  { [k in T[0]]: ParsedType<T[1]> } & ParsedPack<U> :
  never : never : never : never;

function getSize(size: FieldType): number {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'i8': case 'u8': return 1;
    case 'i16': case 'u16': return 2;
    case 'i32': case 'u32': return 4;
    case 'i64': case 'u64': return 8;
    default: return parseInt(size.slice(3), 10);
  }
}

export function parsePack<T extends PackSchema>(schema: T, pack: Buffer): ParsedPack<T> {
  let result = {} as any, offset = 0;
  for (let i of schema) {
    let v;
    if (typeof i[1] === 'number')
      v = pack.slice(offset, offset + i[1]);
    else
      switch (i[1]) {
        case 'i8': v = pack.readInt8(offset); break;
        case 'u8': v = pack.readUInt8(offset); break;
        case 'i16': v = pack.readInt16LE(offset); break;
        case 'u16': v = pack.readUInt16LE(offset); break;
        case 'i32': v = pack.readInt32LE(offset); break;
        case 'u32': v = pack.readUInt32LE(offset); break;
        case 'i64': v = pack.readBigInt64LE(offset); break;
        case 'u64': v = pack.readBigUInt64LE(offset); break;
        default: v = pack.slice(offset, offset + getSize(i[1])).toString();
      }
    result[i[0]] = v;
    offset += getSize(i[1]);
  }
  if (offset !== pack.length) throw new Error(`invalid pack size: ${offset} != ${pack.length}`);
  return result;
}

export function formatPack<T extends PackSchema>(schema: T, data: ParsedPack<T>): Buffer {
  let result = Buffer.alloc(schema.reduce((a, b) => a + getSize(b[1]), 0));
  let offset = 0;
  for (let i of schema) {
    let v = (data as any)[i[0]];
    if (typeof i[1] === 'number') 
			(v as Buffer).copy(result, offset, 0, i[1]);
    else
      switch (i[1]) {
        case 'i8': result.writeInt8(v, offset); break;
        case 'u8': result.writeUInt8(v, offset); break;
        case 'i16': result.writeInt16LE(v, offset); break;
        case 'u16': result.writeUInt16LE(v, offset); break;
        case 'i32': result.writeInt32LE(v, offset); break;
        case 'u32': result.writeUInt32LE(v, offset); break;
        case 'i64': case 'u64': throw new Error('64-bit integer not supported');
        // case 'i64': result.writeBigInt64LE(v, offset); break;
        // case 'u64': result.writeBigUInt64LE(v, offset); break;
        default: result.write(v as string, offset, getSize(i[1]));
      }
    offset += getSize(i[1]);
  }
  return result;
}