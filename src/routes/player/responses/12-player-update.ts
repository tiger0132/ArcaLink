import { Room } from '@/entities/room';
import { defaultPlayer, playerInfoSchema } from '@/lib/linkplay';
import { p, typeOf } from '@/lib/packer';
import { randomUInt } from '@/lib/utils';
import util from 'util';

export const schema = p().struct([
  p('prefix').buf(4, Buffer.from('0616120b', 'hex')),
  p('id').buf(8),        // [4,  12) Room.id
  p('counter').u32(),    // [12, 16)
  p('nonce').u64(),      // [16, 24) nonce

  p('playerIndex').u8(), // [24]
  playerInfoSchema,      // [25, 48)
]);

export const format = (
  nonce: bigint | null,
  room: Room,
  playerIndex: number,
  playerInfo?: typeOf<typeof playerInfoSchema>,
) => {
  let pack = schema.format({
    id: room.id,
    counter: ++room.counter,
    nonce: nonce ?? randomUInt(),

    playerIndex,
    playerInfo: playerInfo ?? room.players[playerIndex]?.getPlayerInfo() ?? defaultPlayer,
  });
  room.pushPack(pack);
  return pack;
}

export const stringify = (data: typeof schema['type']) => [
  '[12 player-update]',
  `cnt=${data.counter}`,
  `idx=${data.playerIndex}`,
  `songTime=${data.playerInfo.songTime}`,
  config.debugLevel === 'less' ? null : `player=\n` + util.inspect(data.playerInfo, { colors: true, depth: null }),
].filter(x => x).join(', ');