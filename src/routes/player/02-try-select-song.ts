import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format13 } from './responses/13-part-roominfo';
import { RoomState } from '@/lib/linkplay';
import { format as format0d, InGameError } from './responses/0d-send-error';
import { format as format11 } from './responses/11-players-info';

export const name = '02-try-select-song';
export const prefix = Buffer.from('0616020b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12) token
  p('counter').u32(),     // [12, 16) 看起来像是某种命令计数一样的东西，似乎是每一条 S->C 的有效命令都会 +1，可能用于保证顺序（upd：看起来是用来补包？）
  p('nonce').u64(),       // [16, 24) nonce

  p('songIdx').i16(),     // [24, 26)
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { nonce, songIdx } = data;

  try {
    if (player !== room.host)
      throw InGameError.NotHost;
    if (room.state !== RoomState.Choosing)
      throw InGameError.CannotStart;
    if (room.players.length < 2)
      throw InGameError.NeedMorePlayers;
    if (room.canPlaySong(songIdx) !== 'ok')
      throw InGameError.CannotPlaySong;

    room.state = RoomState.NotReady;
    room.songIdx = songIdx;

    room.broadcast(format11(nonce, room), format13(nonce, room));
    server.send(format0d(nonce, room, 0), player);
  } catch (e) {
    if (typeof e === 'number')
      server.send(format0d(nonce, room, e), player);
  }
};