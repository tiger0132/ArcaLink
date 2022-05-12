import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import { randomUInt, stringifyBuf } from '@/lib/utils';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616140b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('nonce').u64(),      // [16, 24) nonce

  p('songMap').buf(state.common.songMapLen),  // [24, 536)
]);

export const format = (
  nonce: bigint | null,
  room: Room,
) => {
  let pack = schema.format({
    id: room.id,
    counter: ++room.counter,
    nonce: nonce ?? randomUInt(),

    songMap: room.songMap,
  });
  room.pushPack(pack);
  return pack;
}

export const stringify = (data: typeof schema['type']) => [
  '[14 songmap-update]',
  `cnt=${data.counter}`,
  state.common.debugLevel === 'less' ? null : `songMap=${stringifyBuf(data.songMap)}`,
].filter(x => x).join(', ');