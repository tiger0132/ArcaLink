import { encryptPack, hrtime } from '@/lib/utils';
import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format0c } from './responses/0c-ping';
import { format as format13 } from './responses/13-part-roominfo';
import { format as format12 } from './responses/12-player-update';
import { RoomState } from '@/lib/linkplay';
import { inspect } from 'util';

export const name = '09-ping';
export const prefix = Buffer.from('0616090b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12) token
  p('counter').u32(),     // [12, 16) 看起来像是某种命令计数一样的东西，似乎是每一条 S->C 的有效命令都会 +1，可能用于保证顺序（upd：看起来是用来补包？）
  p('clientTime').u64(),  // [16, 24) std::chrono::steady_clock::now() / 1000
  p('score').u32(),       // [24, 28) a2 准备时和游玩时为自己在这首歌的分数，否则为 0
  p('songTime').u32(),    // [28, 32) a3 游玩时是曲目时间戳 (ms)，永远是 100ms 的倍数，否则为 0
  p('state').u8(),        // [32]     a4 (MultiplayerSongProgressStage)

  p('difficulty').i8(),   // [33]     a5 准备时和游玩时为当前选择的难度，否则为 -1
  p('clearType').u8(),    // [34]     a6 准备时和游玩时为当前的 cleartype + 1，否则为 0 (MultiplayerClearType)
  p('downloadProg').i8(), // [35]     a7 下载进度，没有就是 -1

  p('char').i8(),         // [36]     a8 搭档 id
  p('uncapped').u8(),     // [37]     a9 是否觉醒
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { clientTime } = data;

  // 不理这种怪人
  if (data.counter > room.counter) return;

  // 补包
  if (data.counter < room.counter) {
    for (let pack of room.getResendPacks(data.counter))
      server.send(pack, player);
    return;
  }

  // 首先返回正常 0c 包
  if (Date.now() - player.lastPing >= state.common.pingInterval) {
    player.lastPing = Date.now();
    server.send(format0c(clientTime, room), player, true);
  }

  // 初次连接 / 重新连接
  player.refreshTimer();
  if (!player.online) {
    player.online = true;

    if (room.players.length > 1) // 如果是加入，那么发一个 12 包
      room.broadcast(format12(null, room, room.players.indexOf(player)));
    if (room.isAllOnline())
      room.setState(RoomState.Choosing);
    room.broadcast(format13(null, room));
  }

  // 更新玩家信息
  let flag12 = false;
  for (let key of ['char', 'uncapped'] as const)
    if (data[key] !== player[key]) {
      (player as any)[key] = data[key];
      flag12 = true;
      break;
    }
  if (flag12)
    room.broadcast(format12(null, room, room.players.indexOf(player)));
};