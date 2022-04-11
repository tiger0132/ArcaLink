import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { formatPack, parsePack } from '@/lib/utils';

import type { AdminHandler } from '.';

export const name = '01-new-room';
export const prefix = Buffer.from('013201', 'hex');

const schemaIn = [
  ['nonce', 8],
  ['name', 16],
  ['userId', 'u32'],
  ['songMap', state.common.songMapLen],
] as const;

const schemaOut = [
  ['nonce', 8],
  ['roomCode', 'str6'],
  ['roomId', 8],
  ['token', 8],
  ['key', 16],
  ['playerId', 'u32'],
  ['userId', 'u32'],
  ['orderedAllowedSongs', state.common.songMapLen],
] as const;

console.log(state.common.songMapLen);

export const handler: AdminHandler = (msg, remote, { server }) => {
  let { nonce, name, userId, songMap } = parsePack(schemaIn, msg.body);

  let room = new Room();
  let player = new Player(room, name, userId, room.id, songMap);
  room.players = [player];
  room.updateSongMap();

  let pack = formatPack(schemaOut, {
    nonce,
    roomCode: room.code,
    roomId: room.id,
    token: player.token,
    key: player.key,
    playerId: player.playerId,
    userId: player.userId,
    orderedAllowedSongs: room.songMap,
  });
  server.send(pack, remote.port, remote.address);
};
