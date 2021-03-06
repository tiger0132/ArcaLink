import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import { hrtime } from '@/lib/utils';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('06160c0b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('nonce').u64(),      // [16, 24) nonce
  p('state').u8(),       // [24]
  p('countdown').i32(),  // [25, 29) 倒计时，没有就是 -1
  p('serverTime').u64(), // [29, 37) 服务器时间（microtime）
]);

export const format = (
  nonce: bigint,
  room: Room
) => {
  // 这个地方应该要更新倒计时，如果不更新会导致准备页面倒计时反复横跳
  // 但是如果你更新，它就会失去同步
  // 我是再也懒得碰 616 这些个【】写的【】东西了
  
  
  // PRs welcome

  // room.updateCountdown();

  return schema.format({
    id: room.id,
    counter: room.counter,
    nonce,
    state: room.state,
    countdown: room.countdown,
    serverTime: hrtime(),
  });
};

export const stringify = (data: typeof schema['type']) => [
  '[0c ping]',
  `cnt=${data.counter}`,
  `state=${data.state}`,
  `countdown=${data.countdown}`,
].join(', ');