import { playerInfoWithNameSchema, roomInfoWithHostSchema } from '@/lib/linkplay';
import type { Room } from '@/entities/room';
import { p } from '@/lib/packer';
import { stringifyBuf } from '@/lib/utils';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616150b', 'hex')),
  p('id').buf(8),         // [4,  12) Room.id
  p('counter').u32(),     // [12, 16)

  p('playersInfo').array(4, playerInfoWithNameSchema), // [16, 176)
  p('songMap').buf(state.common.songMapLen),  // [176, 688)

  roomInfoWithHostSchema, // [688, 759)
]);

export const format = (room: Room) => {
  let pack = schema.format({
    id: room.id,
    counter: room.counter,

    playersInfo: room.getPlayersInfoWithName(),
    songMap: room.songMap,

    roomInfoWithHost: room.getRoomInfoWithHost(),
  });
  room.pushPack(pack);
  return pack;
}

export const stringify = (data: typeof schema['type']) => [
  '[15 full-roominfo]',
  `cnt=${data.counter}`,
  state.common.debugLevel === 'less' ? null : `players=\n${util.inspect(data.playersInfo, { colors: true, depth: null })}\n`,
  state.common.debugLevel === 'less' ? null : `songMap=${stringifyBuf(data.songMap)}\n`,
  state.common.debugLevel === 'less' ? null : `room=\n${util.inspect(data.roomInfoWithHost, { colors: true, depth: null })}\n`,
].filter(x => x).join(', ');