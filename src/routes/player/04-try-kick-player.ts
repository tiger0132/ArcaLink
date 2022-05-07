import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format0d, InGameError } from './responses/0d-send-error';

export const name = '04-try-kick-player';
export const prefix = Buffer.from('0616040b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('clientTime').u64(),  // [16, 24) std::chrono::steady_clock::now() / 1000
  p('id').u64(),          // [24, 32) Player.id
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { clientTime, id } = data;
  try {
    if (room.host !== player) throw InGameError.NotHost;

    let target = room.players.find(p => p.playerId === id);
    // 你知道吗：房主是可以踢掉自己的

    if (!target) throw 2; // 踢了不存在的人

    room.removePlayer(target);
  } catch (e) {
    if (typeof e === 'number')
      server.send(format0d(clientTime, room, e), player);
  }
};