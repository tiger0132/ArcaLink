import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { playerInfoSchema } from '@/lib/linkplay';
import { p } from '@/lib/packer';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('06160e0b', 'hex')),
  p('id').buf(8),           // [4,  12) Room.id
  p('counter').u32(),       // [12, 16)

  playerInfoSchema,         // [16, 39)
  p('lastScore').u32(),     // [39, 43)
  p('lastSongTime').u32(),  // [43, 47)
]);

export const format = (
  room: Room,
  player: Player,
) => schema.format({
  id: room.id,
  counter: room.counter,

  playerInfo: player.getPlayerInfo(),
  lastScore: player.lastScore,
  lastSongTime: player.lastSongTime,
});

export const stringify = (data: typeof schema['type']) => [
  '[0e score-update]',
  `player=${JSON.stringify(data.playerInfo, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`,
  `lastScore=${data.lastScore}`,
  `lastSongTime=${data.lastSongTime}`,
].join(', ');