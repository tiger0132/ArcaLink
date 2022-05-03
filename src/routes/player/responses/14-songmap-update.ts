import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import { stringifyBuf } from '@/lib/utils';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616140b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('songMap').buf(state.common.songMapLen),  // [24, 536)
]);

export const format = (
  meta: { clientTime: bigint },
  room: Room,
) => schema.format({
  id: room.id,
  counter: room.counter,
  clientTime: meta.clientTime,

  songMap: room.songMap,
});

export const stringify = (data: typeof schema['type']) => [
  '[14 songmap-update]',
  `cnt=${data.counter}`,
  state.common.debugLevel === 'less' ? null : `songMap=${stringifyBuf(data.songMap)}`,
].filter(x => x).join(', ');