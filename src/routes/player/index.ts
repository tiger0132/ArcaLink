import { Server, ServerRoute } from '@/lib/server';
import { decryptPack, stringifyBuf } from '@/lib/utils';

const server = new Server('player', 4, (msg: Buffer) => {
  try {
    let token = msg.slice(0, 8);
    let user = manager.playerTokenMap.get(token.readBigUInt64LE().toString());
    if (!user) return null;
    let body = decryptPack(msg, user.key);
    console.log(stringifyBuf(body))
    return { user, body };
  } catch {
    return null;
  }
});

const routes: ServerRoute<typeof server>[] = [
  await import('./09-ping'),
];
routes.forEach(server.register.bind(server));

export type PlayerHandler = ServerRoute<typeof server>['handler'];
export default server;