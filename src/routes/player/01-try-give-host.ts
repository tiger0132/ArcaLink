import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format0d, InGameError } from './responses/0d-send-error';

export const name = '01-try-give-host';
export const prefix = Buffer.from('0616010b', 'hex');

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
    if (room.host !== player)
      throw InGameError.NotHost;

    let host = room.players.find(p => p.playerId === id);
    if (!host || host === player) // 给了不存在的人或者自己
      throw InGameError.PlayerNotFound;
    
    if (!host.online)
      throw InGameError.Unknown2; // 不在线返回 2

    room.setHost(host, clientTime);
  } catch (e) {
    if (typeof e === 'number')
    server.send(format0d(clientTime, room, e), player);
  }

  // 以及，616 似乎无论有没有成功修改 host 都会发一个 13 包
  // 和加入房间时的冗余 13 包一样，印证了 616 是手动处理的 13 包？
  // 总之不打算复刻这个行为
};