import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';

export const name = '08-round-robin-enabled';
export const prefix = Buffer.from('0616080b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('clientTime').u64(),  // [16, 24)
  p('enabled').u8(),      // [24]
]);

export const handler: PlayerHandler = (msg, remote, server) => {
  let data = schema.parse(msg.body);
  
  // todo: process data
};