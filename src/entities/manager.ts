import crypto from 'crypto';

import { Room } from './room';
import { Player } from './player';
import { PlayerServer } from '@/routes/player';

export class LinkPlayManager {
  roomCodeMap: Map<string, Room> = new Map();
  roomIdMap: Map<bigint, Room> = new Map();
  playerTokenMap: Map<bigint, Player> = new Map();
  playerUidMap: Map<number, Player> = new Map();

  constructor(public udpServer: PlayerServer) {}

  randomCode() {
    let id: string;
    while (this.roomCodeMap.has(id = crypto.randomInt(0, 1000000).toString().padStart(6, '0')));
    return id;
  }
  randomID() {
    let id: Buffer;
    while (this.roomIdMap.has((id = crypto.randomBytes(8)).readBigUInt64LE()));
    return id;
  }
  randomToken() {
    let id: Buffer;
    while (this.playerTokenMap.has((id = crypto.randomBytes(8)).readBigUInt64LE()));
    return id;
  }
}