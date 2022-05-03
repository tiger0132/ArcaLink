import { Server, ServerRoute } from '@/lib/server';

const key = config.server.key;
const server = new Server('admin', 3, (msg: Buffer) => {
  if (msg.slice(0, key.length).equals(key)) return { body: msg.slice(key.length) };
  return null;
}, () => { });

const routes: ServerRoute<typeof server>[] = [
  await import('./01-new-room'),
];
routes.forEach(server.register.bind(server));

export type AdminHandler = ServerRoute<typeof server>['handler'];
export default server;