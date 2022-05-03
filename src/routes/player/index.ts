import { Server, ServerRoute } from '@/lib/server';
import { decryptPack, stringifyBuf } from '@/lib/utils';

const server = new Server('player', 4, (msg: Buffer) => {
  try {
    let token = msg.slice(0, 8);
    let player = manager.playerTokenMap.get(token.readBigUInt64LE().toString());
    if (!player) return null;
    let body = decryptPack(msg, player.key);
    if (!player.token.equals(body.slice(4, 12))) return null;
    return { player, body };
  } catch {
    return null;
  }
}, (result, remote, server) => {
  
});

const routes: ServerRoute<typeof server>[] = [
  await import('./09-ping'),
  await import('./0a-leave-room'),
];
routes.forEach(server.register.bind(server));

export type PlayerHandler = ServerRoute<typeof server>['handler'];
export default server;