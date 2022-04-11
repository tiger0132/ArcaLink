import crypto from 'crypto';

import { Room } from './room';
import { Player } from './player';
import { buf2U64String } from '@/lib/utils';

export class LinkPlayManager {
  roomCodeMap: Map<string, Room> = new Map();
  roomIdMap: Map<string, Room> = new Map(); // stringify it as number first
  playerTokenMap: Map<string, Player> = new Map(); // stringify it as number first

  randomCode() {
    let id: string;
    while (this.roomCodeMap.has(id = crypto.randomInt(0, 1000000).toString().padStart(6, '0')));
    return id;
  }
  randomID() {
    let id: Buffer;
    while (this.roomIdMap.has(buf2U64String(id = crypto.randomBytes(8))));
    return id;
  }
  randomToken() {
    let id: Buffer;
    while (this.playerTokenMap.has(buf2U64String(id = crypto.randomBytes(8))));
    return id;
  }
}