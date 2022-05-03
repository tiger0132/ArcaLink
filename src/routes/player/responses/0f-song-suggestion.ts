import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { p } from '@/lib/packer';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('06160f0b', 'hex')),
  p('id').buf(8),      // [4,  12) Room.id
  p('counter').u32(),  // [12, 16)

  p('playerId').u64(), // [16, 24) Player.id
  p('songIdxWithDiff').i16(),  // [24, 26)
]);

export const format = (
  room: Room,
  player: Player,
  songIdxWithDiff: number,
) => schema.format({
  id: room.id,
  counter: room.counter,
  playerId: BigInt(player.playerId),
  songIdxWithDiff /* 内容是 (idx * 4 + diff) */,
});

export const stringify = (data: typeof schema['type']) => [
  '[0f song-suggestion]',
  `cnt=${data.counter}`,
  `player=${data.playerId}`,
  `idx=${data.songIdxWithDiff}`,
].join(', ');