import { encryptPack } from '@/lib/utils';
import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format } from './responses/0c-ping';

export const name = '09-ping';
export const prefix = Buffer.from('06160909', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12) Player.token
  p('counter').u32(),     // [12, 16) 看起来像是某种命令计数一样的东西，似乎是每一条 S->C 的有效命令都会 +1，可能用于保证顺序
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

export const handler: PlayerHandler = ({ body, player }, remote, { server }) => {
  let [data] = schema.parse(body);

  let room = player.room;
  if (data.counter === 0) {
    // 初次连接
    room.counter++;
  }

  let pack = encryptPack(player.token, format(data, room), player.key);
  server.send(pack, remote.port, remote.address);
};

/*
default (MultiplayerLobbyLayer::update): 0 0 1 -1 0 -1 29 1

selectsong [9876057, 0, 3, 0, 3, -1, 29, 0]

在游玩时
- a2 似乎是你的分数
- a3 似乎是当前曲目的时间
- a5, a6, a7, a8, a9 分别是 [-1, 0, -1, -1, 0]
- 如果死了或者结算，a4 会变成 8
- 如果活着，a4 会变成 7

---

创房的时候会发一个 15，然后发一个 13，counter 分别是 4 和 5

---

有人进房的话，先会发一个 11，然后发 13
真正加入之后不知道

---

如果 counter 为 0 那么一定会给一个最新 counter 的 full-roominfo
为正数且小于最新 counter 那么会给 part-roominfo
大于最新 counter 就直接不给

*/