import crypto, { randomInt } from 'crypto';
import microtime from 'microtime';

export function decryptPack(data: Buffer, key: Buffer) {
  let iv = data.slice(8, 20);
  let authTag = data.slice(20, 32);
  let body = data.slice(32);

  let decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = Buffer.concat([decipher.update(body), decipher.final()]);

  // 不知道为什么，616 会在正好是 16 的倍数的包的时候不 pad
  // 作为 client 的时候，不太能正确处理 616 不 pad 的 12 包
  return decrypted;

  // remove PKCS7 padding
  // let pad = decrypted[decrypted.length - 1];
  // if (pad > 16) throw new Error('invalid padding');
  // return pad ? decrypted.slice(0, -pad) : decrypted;
}

export function encryptPack(token: Buffer, body: Buffer, key: Buffer) {
  let iv = crypto.randomBytes(12);

  // PKCS7 padding
  let padded = body;
  if (body.length % 16 !== 0) { // f u 616
    let pad = 16 - (body.length % 16);
    padded = Buffer.concat([body, Buffer.alloc(pad, pad)]);
  }

  let cipher = crypto.createCipheriv('aes-128-gcm', key, iv, { authTagLength: 12 });
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(padded);
  let final = cipher.final();
  let authTag = cipher.getAuthTag();
  return Buffer.concat([token, iv, authTag, encrypted, final]);
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

export const hrtime = () => {
  let [sec, msec] = microtime.nowStruct();
  return BigInt(sec) * 1000000n + BigInt(msec);
}

export const getEncryptedSize = (size: number) => ((size + 15) & 15) + 8 + 12 + 12;
export const randomUInt = () => BigInt(randomInt(0, 4294967295));
export const getDiffPair = (x: number) => [x >> 2, x & 3];