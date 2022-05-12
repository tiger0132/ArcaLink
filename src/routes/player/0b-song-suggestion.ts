import { p } from '@/lib/packer';

import type { PlayerHandler } from '.';
import { format as format0f } from './responses/0f-song-suggestion';

export const name = '0b-song-suggestion';
export const prefix = Buffer.from('06160b0b', 'hex');

export const schema = p().struct([
  p('prefix').buf(4, prefix),

  p('token').buf(8),      // [4 , 12)
  p('counter').u32(),     // [12, 16)
  p('songIdxWithDiff').i16(),     // [16, 18)
]);

export const handler: PlayerHandler = ({ body, player }, server) => {
  let [data] = schema.parse(body);
  let { room } = player;
  let { songIdxWithDiff } = data;

  if (room.canPlayDiff(songIdxWithDiff) === 'invalid')
    return;
  if (
    room.canPlayDiff(songIdxWithDiff) === 'locked' &&
    state.common.ignoreLockedIdx
  )
    return;

  let pack0f = format0f(room, player, songIdxWithDiff);
  for (let p of room.players)
    if (p.online && p !== player)
      server.send(pack0f, p);
};