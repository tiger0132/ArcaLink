import { Player } from '@/entities/player';
import dgram, { RemoteInfo } from 'dgram';
import { encryptPack, stringifyBuf, toHex } from './utils';

export const defaultMiddleware = (msg: Buffer) => ({ body: msg });
export class Server<
  T extends { body: Buffer } = { body: Buffer },
  U = void
  > {
  private routeMap: Map<string, Route<T, U>['handler']>;
  public server: dgram.Socket;
  private middleware;
  private log;
  private end;
  constructor(
    public name: string,
    private prefixSize: number,
    {
      middleware,
      log,
      end,
    }: {
      middleware: (msg: Buffer, remote: RemoteInfo) => T | null;
      log: (server: Server<T, U>, parsedMsg: T) => void,
      end: (result: U, remote: dgram.RemoteInfo, server: Server<T, U>) => void;
    },
  ) {
    this.routeMap = new Map();
    this.server = dgram.createSocket('udp4');

    this.middleware = middleware;
    this.log = log;
    this.end = end;
  }
  register(route: Route<T, U>) {
    if (route.prefix.length === this.prefixSize) {
      this.routeMap.set(route.prefix.slice(0, -1).toString('binary'), route.handler);
      logger.info(`Register route: "${this.name}/${route.name}" (${toHex(route.prefix)})`);
    } else
      logger.error(`Route: "${route.name}"'s prefix (${toHex(route.prefix)}) length is not ${this.prefixSize}`);
  }
  #messageHandler(msg: Buffer, remote: dgram.RemoteInfo) {
    try {
      let parsedMsg = this.middleware(msg, remote);
      if (!parsedMsg) {
        logger.debug(`[${this.name}] unknown message from ` + remote.address + ':' + remote.port + ' - ' + stringifyBuf(msg));
        return;
      }
      this.log(this, parsedMsg);
      // logger.debug(`[${this.name}] ` + remote.address + ':' + remote.port + ' - ' + stringifyBuf(parsedMsg.body));

      let prefix = parsedMsg.body.slice(0, this.prefixSize).slice(0, -1).toString('binary');
      let route = this.routeMap.get(prefix);
      if (!route) {
        logger.warn(`[${this.name}] Unknown command from ${remote.address}:${remote.port}: ${stringifyBuf(parsedMsg.body)}.`);
        return;
      }
      let result = route(parsedMsg, remote, this);
      this.end(result, remote, this);
    } catch (e) {
      logger.error(e + '');
      if (e instanceof Error)
        logger.error(e.stack);
    }
  }
  listen(port: number) {
    this.server.on('listening', () => {
      let addr = this.server.address();
      logger.info('UDP Server listening on ' + addr.address + ":" + addr.port);
    });
    this.server.on('message', this.#messageHandler.bind(this));
    this.server.bind(port);
  }
  send(msg: Buffer, remote: dgram.RemoteInfo): void;
  send(msg: Buffer, player: Player): void;
  send(msg: Buffer, remote: dgram.RemoteInfo | Player) {
    if (remote instanceof Player) {
      if (!remote.remote) return;
      logger.debug(`[${this.name}] send to ${remote.name} - ${stringifyBuf(msg)}`);
      this.server.send(encryptPack(remote.token, msg, remote.key), remote.remote.port, remote.remote.address);
    } else
      this.server.send(msg, remote.port, remote.address);
  }
};

export interface Route<
  T extends { body: Buffer } = { body: Buffer },
  U = void
  > {
  name: string;
  prefix: Buffer;
  handler: (msg: T, remote: dgram.RemoteInfo, server: Server<T, U>) => U;
}

export type ServerRoute<S> = S extends Server<infer T, infer U> ? Route<T, U> : never;