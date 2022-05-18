import { PlayerState } from '@/lib/linkplay';
import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format12 } from './responses/12-player-update';

export const name = '03-song-finish';
export const prefix = Buffer.from('0616030b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),        // [4 , 12)
  p('counter').u32(),       // [12, 16)
  p('nonce').u64(),         // [16, 24) nonce

  p('score').u32(),         // [24, 28)
  p('clearType').u8(),      // [28]     MultiplayerClearType
  p('difficulty').i8(),     // [29]

  p('personalBest').bool(), // [30]
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;

  player.state = PlayerState.GameEnd;

  player.score = data.score;
  player.clearType = data.clearType;
  player.difficulty = data.difficulty;
  player.personalBest = data.personalBest;

  room.broadcast(format12(data.nonce, room, room.players.indexOf(player)));
  if (room.isFinish()) {
    
  }
};

export const stringify = (data: typeof schema['type']) => [
  '[03 song-finish]',
  `data=${JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`,
].join(', ');