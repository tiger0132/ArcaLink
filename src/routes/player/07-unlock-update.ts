import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';

export const name = '07-unlock-update';
export const prefix = Buffer.from('0616070b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('nonce').u64(),       // [16, 24) nonce

  p('songMap').buf(state.common.songMapLen),  // [24, 536)
]);

export const handler: PlayerHandler = ({ body, player }) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { nonce, songMap } = data;

  player.songMap = songMap;
  room.updateSongMap(nonce, true);
};