import { Room } from '@/entities/room';
import { playerInfoWithNameSchema } from '@/lib/linkplay';
import { p } from '@/lib/packer';
import { randomUInt } from '@/lib/utils';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616110b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('playersInfo').array(4, playerInfoWithNameSchema), // [16, 176)
]);

export const format = (
  clientTime: bigint | null,
  room: Room
) => schema.format({
  id: room.id,
  counter: room.counter,
  clientTime: clientTime ?? randomUInt(),

  playersInfo: room.getPlayersInfoWithName(),
});

export const stringify = (data: typeof schema['type']) => [
  '[11 players-info]',
  `cnt=${data.counter}`,
  state.common.debugLevel === 'less' ? null : `players=\n` + util.inspect(data.playersInfo, { colors: true, depth: null }),
].filter(x => x).join(', ');