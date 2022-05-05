import { Server, ServerRoute } from '@/lib/server';
import { decryptPack } from '@/lib/utils';

const server = new Server('player', 4, (msg, remote) => {
  try {
    let token = msg.slice(0, 8);
    let player = manager.playerTokenMap.get(token.readBigUInt64LE());
    if (!player) return null;

    let body = decryptPack(msg, player.key);
    if (!player.token.equals(body.slice(4, 12))) return null;
    
    player.remote = remote;
    return { player, body };
  } catch {
    return null;
  }
}, (result, remote, server) => {

});

const routes: ServerRoute<typeof server>[] = await Promise.all([
  import('./09-ping'),
  import('./0a-leave-room'),
]);
routes.forEach(server.register.bind(server));

export type PlayerHandler = ServerRoute<typeof server>['handler'];
export default server;