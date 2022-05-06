import { Room } from '@/entities/room';
import { roomInfoWithHostSchema } from '@/lib/linkplay';
import { p } from '@/lib/packer';
import { randomUInt } from '@/lib/utils';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616130b', 'hex')),
  p('id').buf(8),         // [4,  12) Room.id
  p('counter').u32(),     // [12, 16)
  p('clientTime').u64(),  // [16, 24) std::chrono::steady_clock::now() / 1000

  roomInfoWithHostSchema, // [24, 86)
]);

export const format = (
  clientTime: bigint | null,
  room: Room
) => {
  let pack = schema.format({
    id: room.id,
    counter: ++room.counter,
    clientTime: clientTime ?? randomUInt(),

    roomInfoWithHost: room.getRoomInfoWithHost(),
  });
  room.pushPack(pack);
  return pack;
}

export const stringify = (data: typeof schema['type']) => [
  '[13 part-roominfo]',
  `cnt=${data.counter}`,
  state.common.debugLevel === 'less' ? null : `room=\n` + util.inspect(data.roomInfoWithHost, { colors: true, depth: null }),
].filter(x => x).join(', ');