import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format13 } from './responses/13-part-roominfo';
import { ClearType, Difficulty, RoomState } from '@/lib/linkplay';
import { format as format0d, InGameError } from './responses/0d-send-error';
import { format as format11 } from './responses/11-players-info';

export const name = '06-return-to-lobby';
export const prefix = Buffer.from('0616060b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12) token
  p('counter').u32(),     // [12, 16) 看起来像是某种命令计数一样的东西，似乎是每一条 S->C 的有效命令都会 +1，可能用于保证顺序（upd：看起来是用来补包？）
  p('nonce').u64(),       // [16, 24) random code
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { nonce } = data;

  try {
    if (player !== room.host)
      throw InGameError.NotHost;
    if (room.state !== RoomState.NotReady && room.state !== RoomState.Countdown) // mark
      throw 4;

    room.leavePrepareState(nonce);
  } catch (e) {
    if (typeof e === 'number')
      server.send(format0d(nonce, room, e), player);
  }
};