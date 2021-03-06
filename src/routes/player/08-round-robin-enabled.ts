import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format0d, InGameError } from './responses/0d-send-error';

export const name = '08-round-robin-enabled';
export const prefix = Buffer.from('0616080b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('nonce').u64(),       // [16, 24)
  p('enabled').bool(),      // [24]
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { nonce, enabled } = data;
  if (room.host !== player)
    return server.send(format0d(nonce, room, InGameError.NotHost), player);

  room.setRoundRobin(enabled, nonce);
};