import util from 'util';

import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { formatPack, parsePack } from '@/lib/utils';

import type { PlayerHandler } from '.';

export const name = '09-ping';
export const prefix = Buffer.from('06160909', 'hex');

const schemaIn = [
  ['key', 8],            // [4,  12) Player.key
  ['this + 32', 'u32'],  // [12, 16) 看起来像是某种命令计数一样的东西，似乎是每一条有效命令（C->S、S->C 均计算在内）都会 +1，可能用于保证顺序
  ['time', 'u64'],       // [16, 24) std::chrono::steady_clock::now() / 1000
  ['this + 888', 'u32'], // [24, 28) a2
  ['this + 892', 'u32'], // [28, 32) a3
  ['this + 896', 'u8'],  // [32]     a4 (MultiplayerSongProgressStage)

  ['this + 976', 'u8'],  // [33]     
  ['this + 977', 'u8'],  // [34]     a6 (MultiplayerClearType)
  ['this + 978', 'u8'],  // [35]     
  
  ['this + 979', 'u8'],  // [36]     
  ['this + 980', 'u8'],  // [37]     
] as const;

export const handler: PlayerHandler = (msg, remote, { server }) => {
  let data = parsePack(schemaIn, msg.body);
  console.log(util.inspect(data, { colors: true }));
};
