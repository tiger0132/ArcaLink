import dgram from 'dgram';
import { stringifyBuf, toHex } from './utils';

export const defaultMiddleware = (msg: Buffer) => ({ body: msg });
export class Server<
  T extends { body: Buffer } = { body: Buffer },
  U = void
  > {
  private routeMap: Map<string, Route<T, U>['handler']>;
  public server: dgram.Socket;
  constructor(
    private name: string,
    private prefixSize: number,
    private middleware: (msg: Buffer) => T | null,
    private end: (result: U, remote: dgram.RemoteInfo, server: Server<T, U>) => void,
  ) {
    this.routeMap = new Map();
    this.server = dgram.createSocket('udp4');
  }
  register(route: Route<T, U>) {
    if (route.prefix.length === this.prefixSize) {
      this.routeMap.set(route.prefix.toString('binary'), route.handler);
      logger.info(`Register route: "${this.name}/${route.name}" (${toHex(route.prefix)})`);
    } else
      logger.error(`Route: "${route.name}"'s prefix (${toHex(route.prefix)}) length is not ${this.prefixSize}`);
  }
  #messageHandler(msg: Buffer, remote: dgram.RemoteInfo) {
    try {
      let parsedMsg = this.middleware(msg);
      if (!parsedMsg) {
        logger.debug(`[${this.name}] unknown message from ` + remote.address + ':' + remote.port + ' - ' + stringifyBuf(msg));
        return;
      }
      logger.debug(`[${this.name}] ` + remote.address + ':' + remote.port + ' - ' + stringifyBuf(parsedMsg.body));

      let prefix = parsedMsg.body.slice(0, this.prefixSize).toString('binary');
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