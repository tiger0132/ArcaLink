import crypto from 'crypto';

import { Room } from './room';
import { buf2U64String } from '@/lib/utils';

export class Player {
  name: Buffer; // buf(16) (string)
  playerId: number; // u32
  userId: number; // u32
  token: Buffer; // buf(8) (u64)
  key: Buffer; // buf(16)
  songMap: Buffer; // buf(512 <- state.common.songMapLen)

  get tokenString() { return buf2U64String(this.token); }
  static #seq: number = 0;

  constructor(
    public room: Room,
    name: Buffer,
    userId: number,
    token: Buffer | null,
    songMap: Buffer
  ) {
    this.name = name.slice(0, 16);
    if (this.name.length < 16)
      this.name = Buffer.concat([this.name, Buffer.alloc(16 - this.name.length)]);

    this.playerId = Player.#seq++;
    this.userId = userId;
    this.token = token ?? manager.randomToken();
    this.key = crypto.randomBytes(16);
    this.songMap = songMap;

    manager.playerTokenMap.set(this.tokenString, this);
  }
  destroy() {
    manager.playerTokenMap.delete(this.tokenString);
  }
};