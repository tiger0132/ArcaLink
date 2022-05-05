// 还不知道是啥，感觉也不像什么 state update
// 会不会其实是错误码啊

import { Room } from '@/entities/room';
import { p } from '@/lib/packer';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('06160d0b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('state').u8(),       // [24]
]);

export const format = (
  clientTime: bigint,
  room: Room,
  state: number,
) => schema.format({
  id: room.id,
  counter: room.counter,
  clientTime,
  state,
});

export const stringify = (data: typeof schema['type']) => [
  '[0d state-update]',
  `cnt=${data.counter}`,
  `state=${data.state}`,
].join(', ');