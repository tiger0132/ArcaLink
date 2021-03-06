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
    let prefix = route.prefix;
    if (prefix.length === this.prefixSize) {
      if (config.server.allowDifferentVersion)
        prefix = prefix.slice(0, -1);
      this.routeMap.set(prefix.toString('binary'), route.handler);
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

      let prefix = parsedMsg.body.slice(0, this.prefixSize);
      if (config.server.allowDifferentVersion)
        prefix = prefix.slice(0, -1);
      let route = this.routeMap.get(prefix.toString('binary'));
      if (!route) {
        logger.warn(`[${this.name}] Unknown command from ${remote.address}:${remote.port}: ${stringifyBuf(parsedMsg.body)}.`);
        return;
      }
      let result = route(parsedMsg, this);
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
  send(msg: Buffer, remote: dgram.RemoteInfo, silent?: boolean): void;
  send(msg: Buffer, player: Player, silent?: boolean): void;
  send(msg: Buffer, remote: dgram.RemoteInfo | Player, silent: boolean = false) {
    if (remote instanceof Player) {
      if (!remote.remote) return;
      if (!silent && msg[2] !== 0x0e)
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
  handler: (msg: T, server: Server<T, U>) => U;
}

export type ServerRoute<S> = S extends Server<infer T, infer U> ? Route<T, U> : never;