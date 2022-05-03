import { playerInfoWithNameSchema } from '@/entities/player';
import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616100b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('host').u64(),       // [24, 32)
]);

export const format = (
  meta: { clientTime: bigint },
  room: Room
) => {
  if (!room.host) throw new Error('room.host is null');
  return schema.format({
    id: room.id,
    counter: room.counter,
    clientTime: meta.clientTime,

    host: BigInt(room.host.playerId),
  });
};

export const stringify = (data: typeof schema['type']) => [
  '[10 host-change]',
  `cnt=${data.counter}`,
  `host=${data.host}`,
].join(', ');