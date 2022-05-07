import { Player } from '@/entities/player';
import { Server, ServerRoute } from '@/lib/server';
import { decryptPack, stringifyBuf } from '@/lib/utils';

const server = new Server<{ body: Buffer; player: Player }>('player', 4, {
  middleware(msg, remote) {
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
  },
  log(server, parsedMsg) {
    logger.debug(`[${server.name}] ${parsedMsg.player.name}` + ' - ' + stringifyBuf(parsedMsg.body));
  },
  end(result, remote, server) {

  }
});

const routes: ServerRoute<typeof server>[] = await Promise.all([
  import('./01-try-give-host'),
  import('./09-ping'),
  import('./0a-leave-room'),
  import('./0b-song-suggestion'),
]);
routes.forEach(server.register.bind(server));

export type PlayerServer = typeof server;
export type PlayerHandler = ServerRoute<typeof server>['handler'];
export default server;