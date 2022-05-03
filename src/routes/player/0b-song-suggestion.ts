import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';

export const name = '0b-song-suggestion';
export const prefix = Buffer.from('06160b09', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('songIdx').i16(),     // [16, 18)
]);

export const handler: PlayerHandler = (msg, remote, { server }) => {
  let data = schema.parse(msg.body);
};