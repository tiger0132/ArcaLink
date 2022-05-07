// 还不知道是啥，感觉也不像什么 state update
// 会不会其实是错误码啊

import { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import { randomUInt } from '@/lib/utils';

export enum InGameError {
  NotHost = 3, // 你不是房主
  CannotStart = 5, // 有玩家目前无法开始
  NeedMorePlayers = 6, // 需要更多的玩家以开始
  CannotPlayThisSong = 7, // 有玩家无法游玩这首歌曲
}

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('06160d0b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('clientTime').u64(), // [16, 24) std::chrono::steady_clock::now() / 1000

  p('code').u8(),       // [24]
]);

export const format = (
  clientTime: bigint | null,
  room: Room,
  code: InGameError,
) => schema.format({
  id: room.id,
  counter: room.counter,
  clientTime: clientTime ?? randomUInt(),
  code,
});

export const stringify = (data: typeof schema['type']) => [
  '[0d send-error]',
  `cnt=${data.counter}`,
  `code=${data.code}`,
].join(', ');