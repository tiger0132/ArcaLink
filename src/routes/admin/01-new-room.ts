import { Player } from '@/entities/player';
import { Room } from '@/entities/room';
import { p } from '@/lib/packer';

import type { AdminHandler } from '.';

export const name = '01-new-room';
export const prefix = Buffer.from('013201', 'hex');

const schemaBody = p().struct([
  p('prefix').buf(3, prefix),
  p('nonce').buf(8),
  p('name').buf(16),
  p('userId').u32(),
  p('songMap').buf(state.common.songMapLen),
]);

const schemaResp = p().struct([
  p('nonce').buf(8),
  p('roomCode').str(6),
  p('roomId').buf(8),
  p('token').buf(8),
  p('key').buf(16),
  p('playerId').u32(),
  p('userId').u32(),
  p('orderedAllowedSongs').buf(state.common.songMapLen),
]);

export const handler: AdminHandler = (msg, remote, { server }) => {
  let [{ nonce, name, userId, songMap }] = schemaBody.parse(msg.body);

  let room = new Room();
  // let player = new Player(room, name, userId, room.id, songMap);
  let player = new Player(room, name, userId, null, songMap);
  room.players = [player];
  room.host = player;
  room.updateSongMap();

  let pack = schemaResp.format({
    nonce,
    roomCode: room.code,
    roomId: room.id,
    token: player.token,
    key: player.key,
    playerId: player.playerId,
    userId: player.userId,
    orderedAllowedSongs: room.songMap,
  });
  console.log(pack);
  server.send(pack, remote.port, remote.address);
};
