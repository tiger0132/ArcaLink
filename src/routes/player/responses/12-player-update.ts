import { playerInfoSchema } from '@/entities/player';
import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616120b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('playerIndex').u8(), // [24]
  playerInfoSchema,      // [25, 47)
]);

export const format = (
  meta: { clientTime: bigint },
  room: Room,
  playerIndex: number,
) => schema.format({
  id: room.id,
  counter: room.counter,
  clientTime: meta.clientTime,

  playerIndex,
  playerInfo: room.players[playerIndex].getPlayerInfo(),
});

export const stringify = (data: typeof schema['type']) => [
  '[12 player-update]',
  `cnt=${data.counter}`,
  `idx=${data.playerIndex}`,
  state.common.debugLevel === 'less' ? null : `player=\n` + util.inspect(data.playerInfo, { colors: true, depth: null }),
].filter(x => x).join(', ');